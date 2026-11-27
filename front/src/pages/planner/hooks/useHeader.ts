import type { HeaderProps } from "../components/index.ts";

export const useHeader = ({ action }: HeaderProps) => {
  const openPlanner = () => action("workspace");
  const openPrivacy = () => action("privacy");

  const navItems = (
    [
      ["catalog", "grid", "Каталог"],
      ["estimate", "receipt", "Смета"]
    ] as const
  ).map(([key, icon, label]) => {
    const openNav = () => action(key);
    return { key, icon, label, openNav };
  });

  return { navItems, openPlanner, openPrivacy };
};
