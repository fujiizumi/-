import { useRoute } from "../router";

export function usePathname() {
  const r = useRoute();
  return `/${r.split(":")[0]}`;
}
