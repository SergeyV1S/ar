import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { getCatalogCities } from "@/shared/api/requests";
import type { CatalogCity } from "@/shared/api/requests";
import axios from "axios";

import { PROJECT_ITEM_LIMIT } from "../helpers/catalogSelection.ts";
import { isCatalogCategory } from "../types/index.ts";
import type { CatalogSearch } from "../types/index.ts";

type CityState = { status: "loading" | "ready" | "error" | "disabled"; cities: CatalogCity[] };

const numberField = (data: FormData, field: string) => {
  const value = data.get(field);
  if (typeof value === "string" && value.trim()) return Number(value);
};

export const useCatalogSearchForm = ({
  initial,
  start
}: {
  initial: Partial<CatalogSearch>;
  start: (search: CatalogSearch, city: CatalogCity) => void;
}) => {
  const [city, setCity] = useState(initial.city ?? "");
  const [cityState, setCityState] = useState<CityState>({ status: "loading", cities: [] });
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void getCatalogCities({ config: { signal } }).then(
      (cities) => {
        if (!signal.aborted) setCityState({ status: "ready", cities });
      },
      (error: unknown) => {
        if (axios.isCancel(error) || signal.aborted) return;
        const disabled = axios.isAxiosError(error) && error.response?.status === 503;
        setCityState({ status: disabled ? "disabled" : "error", cities: [] });
      }
    );
    return () => controller.abort();
  }, [attempt]);

  const changeCity = (event: React.ChangeEvent<HTMLSelectElement>) => setCity(event.target.value);
  const retryCities = () => {
    setCityState({ status: "loading", cities: [] });
    setAttempt((current) => current + 1);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const category = data.get("category");
    const quantity = numberField(data, "quantity");
    const selectedCity = cityState.cities.find(({ id }) => id === city);
    const material = data.get("material");
    if (
      !selectedCity ||
      typeof category !== "string" ||
      !isCatalogCategory(category) ||
      quantity === undefined ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > PROJECT_ITEM_LIMIT
    ) {
      setError("Проверьте город, категорию и количество.");
      return;
    }

    const maxTotal = numberField(data, "maxTotal");
    const maxUnit = numberField(data, "maxUnit");
    const width = numberField(data, "maxWidth");
    const depth = numberField(data, "maxDepth");
    const height = numberField(data, "maxHeight");
    start(
      {
        city: selectedCity.id,
        category,
        quantity,
        maxTotal,
        maxUnit,
        material: typeof material === "string" && material ? material : undefined,
        maxWidth: width === undefined ? undefined : width / 100,
        maxDepth: depth === undefined ? undefined : depth / 100,
        maxHeight: height === undefined ? undefined : height / 100,
        replaceId: initial.replaceId
      },
      selectedCity
    );
  };

  const selectedCity = cityState.cities.some(({ id }) => id === city) ? city : "";
  return { city: selectedCity, cityState, error, changeCity, retryCities, submit };
};
