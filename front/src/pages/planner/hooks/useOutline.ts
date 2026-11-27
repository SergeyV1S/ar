import type { FormEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { readNumber } from "../../../shared/helpers/index.ts";
import type { OutlineProps } from "../components/index.ts";
import { dimensions, normalize, validPolygon } from "../planning/index.ts";
import { canvasContext } from "../planning/index.ts";
import type { Point } from "../types/index.ts";

export const useOutline = ({ project, save }: OutlineProps) => {
  const [photo, setPhoto] = useState(""),
    [points, setPoints] = useState<Point[]>([]),
    [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef([0, 0, 1, 1]);
  useEffect(() => {
    const image = new Image();
    const draw = () => {
      const ctx = canvas.current ? canvasContext(canvas.current) : null;
      if (!ctx) return;
      const { c, width, height } = ctx;
      c.clearRect(0, 0, width, height);
      let box: [number, number, number, number] = [12, 12, width - 24, height - 24];
      if (photo && image.complete && image.naturalWidth) {
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        const w = image.naturalWidth * scale,
          h = image.naturalHeight * scale;
        box = [(width - w) / 2, (height - h) / 2, w, h];
        c.drawImage(image, ...box);
      }
      target.current = box;
      const xy = ([x, y]: Point): [number, number] => [box[0] + x * box[2], box[1] + y * box[3]];
      c.beginPath();
      points.forEach((point, i) => (i ? c.lineTo(...xy(point)) : c.moveTo(...xy(point))));
      if (points.length > 2) {
        c.closePath();
        c.fillStyle = "#8659e845";
        c.fill();
      }
      c.strokeStyle = "#7847e6";
      c.lineWidth = 2.6;
      c.stroke();
      points.forEach((point, i) => {
        const [x, y] = xy(point);
        c.beginPath();
        c.arc(x, y, 8, 0, Math.PI * 2);
        c.fillStyle = "#7343e7";
        c.fill();
        c.fillStyle = "#fff";
        c.font = "bold 10px Arial";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(String(i + 1), x, y);
      });
    };
    image.onload = draw;
    if (photo) image.src = photo;
    const observer = new ResizeObserver(draw);
    if (canvas.current) observer.observe(canvas.current);
    draw();
    return () => {
      observer.disconnect();
      image.onload = null;
    };
  }, [photo, points]);
  const onClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect(),
      [x, y, w, h] = target.current;
    const p = [(event.clientX - bounds.left - x) / w, (event.clientY - bounds.top - y) / h];
    if (p.some((v) => v < 0 || v > 1) || points.length >= 32) return;
    setError("");
    setPoints([...points, p]);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (points.length < 3) {
      setError("Отметьте не менее трёх углов.");
      return;
    }
    const data = new FormData(event.currentTarget),
      { w, d } = dimensions(points);
    if (w < 0.035 || d < 0.035) {
      setError("Указанные углы слишком близко друг к другу.");
      return;
    }
    const outline = normalize(
      points.map(([x, y]) => [
        (x * readNumber(data, "width")) / w,
        (y * readNumber(data, "depth")) / d
      ])
    );
    if (!validPolygon(outline)) {
      setError("Обойдите углы по порядку. Линии стен не должны пересекаться.");
      return;
    }
    save(
      {
        ...project.room,
        points: outline,
        openings: [],
        source: photo ? "photo" : "manual",
        verified: "review"
      },
      project.passage
    );
  };
  const { w, d } = dimensions(project.room.points);

  const changePhoto = (value: string) => {
    setPhoto(value);
    setPoints([]);
  };
  const undoPoint = () => setPoints(points.slice(0, -1));

  return { canvas, points, error, onClick, submit, w, d, changePhoto, undoPoint };
};
