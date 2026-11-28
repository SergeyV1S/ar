import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { newId, readNumber, readText, safeUrl } from "../../../shared/helpers/index.ts";
import type { ItemEditorProps } from "../components/index.ts";
import { identifyFurniture } from "../recognition/index.ts";
import type { FurnitureMatch } from "../recognition/index.ts";

export const useItemEditor = ({ item, project, owned, save, remove }: ItemEditorProps) => {
  const [photo, setPhoto] = useState(item?.photo ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [kind, setKind] = useState(item?.kind ?? "other");
  const [source, setSource] = useState(item?.source ?? "manual");
  const [verified, setVerified] = useState(item?.verified ?? "review");
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const [detection, setDetection] = useState<{ status: string; matches: FurnitureMatch[] }>({
    status: "idle",
    matches: []
  });
  const activeScan = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      activeScan.current?.abort();
    },
    []
  );
  const setImage = (value: string) => {
    activeScan.current?.abort();
    setDetection({ status: "idle", matches: [] });
    setPhoto(value);
    setSource(value ? "photo" : "manual");
    setVerified("review");
  };
  const scanImage = async () => {
    activeScan.current?.abort();
    const scan = new AbortController();
    activeScan.current = scan;
    setDetection({ status: "loading", matches: [] });
    try {
      const matches = await identifyFurniture(photo, scan.signal);
      if (!scan.signal.aborted) setDetection({ status: "ready", matches });
    } catch {
      if (!scan.signal.aborted) setDetection({ status: "error", matches: [] });
    } finally {
      if (activeScan.current === scan) activeScan.current = null;
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const url = safeUrl(readText(data, "url"));
    if (readText(data, "url") && !url) {
      setError("Укажите полную ссылку на сайт, начиная с https://.");
      return;
    }
    const width = readNumber(data, "w") / 100,
      depth = readNumber(data, "d") / 100,
      height = readNumber(data, "h") / 100;
    const material = readText(data, "material");
    save({
      ...item,
      id: item?.id ?? newId(),
      owned,
      mode: item?.mode ?? project.mode,
      name: readText(data, "name"),
      kind: readText(data, "kind"),
      w: width,
      d: depth,
      h: height,
      material,
      materials: material === item?.material ? item?.materials : undefined,
      access: readNumber(data, "access") / 100,
      quantity: owned ? undefined : readNumber(data, "quantity"),
      price: readText(data, "price") === "" ? undefined : readNumber(data, "price"),
      cap: readNumber(data, "cap"),
      seller: readText(data, "seller"),
      sku: readText(data, "sku"),
      details: readText(data, "details"),
      availability: readText(data, "availability"),
      url,
      photo,
      source,
      verified
    });
  };
  const markEdited = () => setVerified("review");

  const clearImage = () => setImage("");
  const changeName = (e: ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const changeKind = (e: ChangeEvent<HTMLSelectElement>) => {
    setKind(e.target.value);
    markEdited();
  };
  const changeSource = (e: ChangeEvent<HTMLSelectElement>) => setSource(e.target.value);
  const changeVerification = (e: ChangeEvent<HTMLSelectElement>) => setVerified(e.target.value);
  const confirmRemove = () => {
    if (!item) return;
    if (removing) {
      remove(item.id);
      return;
    }
    setRemoving(true);
  };

  const matchOptions = detection.matches.map(({ title, kind: suggested, score, box }) => {
    const chooseMatch = () => {
      setName(title);
      setKind(suggested);
      setSource("photo");
      markEdited();
    };
    const key = JSON.stringify([suggested, ...box]);
    return { key, title, score, box, chooseMatch };
  });

  return {
    photo,
    name,
    kind,
    source,
    verified,
    error,
    removing,
    detection,
    setImage,
    scanImage,
    submit,
    markEdited,
    matchOptions,
    clearImage,
    changeName,
    changeKind,
    changeSource,
    changeVerification,
    confirmRemove
  };
};
