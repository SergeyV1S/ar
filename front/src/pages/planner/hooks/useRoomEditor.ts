import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";

import { newId, readNumber, readText } from "../../../shared/helpers/index.ts";
import type { RoomEditorProps } from "../components/index.ts";
import { getOpeningWidth } from "../helpers/index.ts";
import { resizeRoom } from "../mock/index.ts";
import { dimensions, distance, validPolygon } from "../planning/index.ts";
import type { Opening } from "../types/index.ts";

type DraftOpening = Omit<Opening, "offset" | "width"> & {
  offset: number | string;
  width: number | string;
};

export const useRoomEditor = ({ project, save, action }: RoomEditorProps) => {
  const [openings, setOpenings] = useState<DraftOpening[]>(project.room.openings);
  const [status, setStatus] = useState(project.room.verified);
  const [error, setError] = useState("");
  const extent = dimensions(project.room.points);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      width = readNumber(data, "width"),
      depth = readNumber(data, "depth");
    const room = resizeRoom(project.room, width, depth);
    const normalizedOpenings = openings.map((opening) => ({
      ...opening,
      offset: Number(opening.offset),
      width: Number(opening.width)
    }));
    if (!validPolygon(room.points)) {
      setError("Проверьте размеры стен и площадь комнаты.");
      return;
    }
    for (const opening of normalizedOpenings) {
      const start = room.points[opening.wall],
        end = room.points[(opening.wall + 1) % room.points.length];
      if (!start || opening.offset + opening.width > distance(start, end) + 0.005) {
        setError(
          "Проём или розетка выходит за границы стены. Проверьте расстояние от начала стены и ширину."
        );
        return;
      }
    }
    const overlap = normalizedOpenings.some(
      (a, index) =>
        a.type !== "socket" &&
        normalizedOpenings
          .slice(index + 1)
          .some(
            (b) =>
              b.type !== "socket" &&
              a.wall === b.wall &&
              a.offset < b.offset + b.width - 0.01 &&
              b.offset < a.offset + a.width - 0.01
          )
    );
    if (overlap) {
      setError("Два проёма перекрываются на одной стене.");
      return;
    }
    const changed = width !== extent.w || depth !== extent.d || openings !== project.room.openings;
    save(
      {
        ...room,
        name: readText(data, "name") || project.room.name,
        openings: normalizedOpenings,
        verified: status,
        source: changed ? "manual" : room.source
      },
      readNumber(data, "passage") / 100
    );
  };
  const change = (id: string, patch: Partial<DraftOpening>) => {
    setOpenings((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setStatus("review");
  };
  const add = () => {
    setOpenings([
      ...openings,
      { id: newId(), type: "door", wall: 0, offset: 0, width: 0.8, hinge: "start" }
    ]);
    setStatus("review");
  };

  const scanRoom = () => action("ar-scan");
  const drawOutline = () => action("outline");
  const markForReview = () => setStatus("review");
  const changeStatus = (e: ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value);

  const openingRows = openings.map((opening) => {
    const remove = () => {
      setOpenings(openings.filter((item) => item.id !== opening.id));
      setStatus("review");
    };
    const changeType = (e: ChangeEvent<HTMLSelectElement>) =>
      change(opening.id, {
        type: e.target.value,
        width: getOpeningWidth(opening, e.target.value)
      });
    const changeWall = (e: ChangeEvent<HTMLSelectElement>) =>
      change(opening.id, { wall: Number(e.target.value) });
    const changeOffset = (e: ChangeEvent<HTMLInputElement>) =>
      change(opening.id, {
        offset: e.target.value === "" ? "" : Number(e.target.value)
      });
    const changeWidth = (e: ChangeEvent<HTMLInputElement>) =>
      change(opening.id, {
        width: e.target.value === "" ? "" : Number(e.target.value)
      });
    const changeHinge = (e: ChangeEvent<HTMLSelectElement>) =>
      change(opening.id, { hinge: e.target.value });
    return { opening, remove, changeType, changeWall, changeOffset, changeWidth, changeHinge };
  });

  return {
    openingRows,
    status,
    error,
    extent,
    submit,
    add,
    scanRoom,
    drawOutline,
    markForReview,
    changeStatus
  };
};
