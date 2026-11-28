"""Adapt the pinned OWLv2 ONNX export for local furniture detection."""

import argparse
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime
from onnx import helper, numpy_helper
from tokenizers import Tokenizer

QUERIES = Path(__file__).parents[1] / "src/pages/planner/recognition/modelQueries.json"
ORIGINAL_GRID = 60
GRID = 40
PATCH_SIZE = 16
HIDDEN = 768


def encode_queries(source, tokenizer_path, queries):
    tokenizer = Tokenizer.from_file(str(tokenizer_path))
    tokenizer.enable_padding(length=16, pad_id=0)
    tokenizer.enable_truncation(max_length=16)
    tokens = tokenizer.encode_batch([f"a photo of a {query}" for query in queries])
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 4
    session = onnxruntime.InferenceSession(str(source), options)
    edge = ORIGINAL_GRID * PATCH_SIZE
    [embeddings] = session.run(["text_embeds"], {
        "pixel_values": np.zeros((1, 3, edge, edge), np.float32),
        "input_ids": np.array([token.ids for token in tokens], dtype=np.int64),
        "attention_mask": np.array([token.attention_mask for token in tokens], dtype=np.int64),
    })
    return embeddings


def interpolate_positions(positions):
    centers = (np.arange(GRID) + 0.5) * ORIGINAL_GRID / GRID - 0.5
    weights = np.zeros((GRID, ORIGINAL_GRID), dtype=np.float32)
    for index in range(-2, ORIGINAL_GRID + 2):
        distance = np.abs(centers - index)
        inner = 1.25 * distance**3 - 2.25 * distance**2 + 1
        outer = -0.75 * distance**3 + 3.75 * distance**2 - 6 * distance + 3
        kernel = np.where(distance <= 1, inner, np.where(distance < 2, outer, 0))
        weights[:, int(np.clip(index, 0, ORIGINAL_GRID - 1))] += kernel
    grid = positions[1:].reshape(ORIGINAL_GRID, ORIGINAL_GRID, HIDDEN)
    return np.einsum("ij,kl,jld->ikd", weights, weights, grid, optimize=True)


def add_patch_grid(graph, nodes, weights):
    name = "owlv2.vision_model.embeddings.position_embedding.weight"
    quantized, zero_point, scale = [
        numpy_helper.to_array(weights[f"{name}_{suffix}"])
        for suffix in ("quantized", "zero_point", "scale")
    ]
    positions = (quantized.astype(np.float32) - zero_point) * scale
    axis = np.arange(1, GRID + 1, dtype=np.float32) / GRID
    centers = np.stack(np.meshgrid(axis, axis), axis=-1)
    sizes = np.full((GRID, GRID, 2), 1 / GRID, dtype=np.float32)
    anchors = np.concatenate((centers, sizes), axis=-1)
    box_bias = np.log(anchors + 1e-4) - np.log(1 - anchors + 1e-4)

    # Crop the resized square grid to the image's patch rows and columns.
    constants = {
        "vision_cls_position": positions[:1],
        "vision_position_grid": interpolate_positions(positions),
        "vision_box_grid": box_bias,
        "vision_slice_start": [0, 0],
        "vision_slice_axes": [0, 1],
        "vision_image_axes": [2, 3],
        "vision_axis_zero": [0],
        "vision_patch_size": PATCH_SIZE,
        "vision_batch": [1],
        "vision_hidden": [HIDDEN],
        "vision_flat_position_shape": [-1, HIDDEN],
        "vision_flat_box_shape": [-1, 4],
    }
    graph.initializer.extend(numpy_helper.from_array(np.asarray(value), key)
                             for key, value in constants.items())
    added = []

    def op(kind, inputs, output, **attributes):
        added.append(helper.make_node(kind, inputs, [output], name=output, **attributes))

    op("Shape", ["pixel_values"], "vision_image_shape")
    op("Gather", ["vision_image_shape", "vision_image_axes"], "vision_image_size")
    op("Div", ["vision_image_size", "vision_patch_size"], "vision_grid_size")
    op("ReduceProd", ["vision_grid_size"], "vision_patches", keepdims=1)
    op("Concat", ["vision_batch", "vision_patches", "vision_hidden"], "/Where_output_0", axis=0)
    op("Concat", ["vision_batch", "vision_grid_size", "vision_hidden"], "/Concat_output_0", axis=0)
    for head in ("position", "box"):
        op("Slice", [f"vision_{head}_grid", "vision_slice_start", "vision_grid_size",
                     "vision_slice_axes"], f"vision_{head}_crop")
        op("Reshape", [f"vision_{head}_crop", f"vision_flat_{head}_shape"], f"vision_{head}_flat")
    op("Concat", ["vision_cls_position", "vision_position_flat"], "vision_positions_with_cls", axis=0)
    op("Unsqueeze", ["vision_positions_with_cls", "vision_axis_zero"], "vision_position_embeddings")

    for name in ("/Where", "/Concat", "/Concat_1", "/Concat_4"):
        graph.node.remove(nodes[name])
    nodes["/Reshape_1"].input[1] = "/Where_output_0"
    nodes["/Add_4"].input[1] = "vision_box_flat"
    nodes["/owlv2/vision_model/embeddings/Add"].input[1] = "vision_position_embeddings"
    for node in reversed(added):
        graph.node.insert(0, node)


def export_model(source, tokenizer, destination):
    queries = list(json.loads(QUERIES.read_text(encoding="utf-8")))
    text_embeddings = encode_queries(source, tokenizer, queries)
    model = onnx.load(source)
    graph = model.graph
    del graph.value_info[:]
    nodes = {node.name: node for node in graph.node}
    weights = {tensor.name: tensor for tensor in graph.initializer}
    add_patch_grid(graph, nodes, weights)

    # Every query is fixed and nonempty, so text encoding and query masking are constant.
    graph.node.remove(nodes["/Reshape_2"])
    graph.initializer.append(numpy_helper.from_array(text_embeddings, "text_embeds"))
    nodes["/class_head/Cast_2"].input[0] = nodes["/class_head/Mul"].output[0]

    model.opset_import.append(helper.make_operatorsetid("com.microsoft", 1))
    for layer in range(12):
        prefix = f"/owlv2/vision_model/encoder/layers.{layer}/self_attn/"
        target = nodes[prefix + "Reshape_7"]
        projections = [nodes[f"{prefix}{part}_proj/Add"].output[0] for part in "qkv"]
        target.CopyFrom(helper.make_node(
            "MultiHeadAttention", projections, list(target.output),
            name=prefix + "Attention", domain="com.microsoft", num_heads=12,
        ))

    input_shape = graph.input[1].type.tensor_type.shape.dim
    input_shape[0].dim_value = 1
    input_shape[1].dim_value = 3
    logits, boxes, _, image_embeddings = graph.output
    for output in (logits, boxes):
        shape = output.type.tensor_type.shape.dim
        shape[0].dim_value = 1
        shape[1].dim_param = "patch_count"
    logits.type.tensor_type.shape.dim[2].dim_value = len(queries)
    image_embeddings.type.tensor_type.shape.dim[1].dim_param = "patch_height"
    image_embeddings.type.tensor_type.shape.dim[2].dim_param = "patch_width"
    detector = onnx.utils.Extractor(model).extract_model(["pixel_values"], ["logits", "pred_boxes"])
    onnx.checker.check_model(detector)
    onnx.save(detector, destination)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("tokenizer", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    export_model(args.source, args.tokenizer, args.destination)
