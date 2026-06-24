import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IonName = ComponentProps<typeof Ionicons>["name"];

const REMIX_TO_ION: Record<string, IonName> = {
  "ri-home-5-line": "home-outline",
  "ri-shopping-cart-2-line": "cart-outline",
  "ri-file-list-3-line": "document-text-outline",
  "ri-hand-coin-line": "cash-outline",
  "ri-draft-line": "create-outline",
  "ri-truck-line": "bus-outline",
  "ri-file-copy-2-line": "copy-outline",
  "ri-group-line": "people-outline",
  "ri-shopping-bag-3-line": "bag-outline",
  "ri-building-2-line": "business-outline",
  "ri-file-text-line": "document-outline",
  "ri-wallet-line": "wallet-outline",
  "ri-price-tag-3-line": "pricetag-outline",
  "ri-box-3-line": "cube-outline",
  "ri-contacts-book-line": "book-outline",
  "ri-bank-line": "library-outline",
  "ri-secure-payment-line": "card-outline",
  "ri-stack-line": "layers-outline",
  "ri-scales-3-line": "scale-outline",
  "ri-bank-card-line": "card-outline",
  "ri-wallet-3-line": "wallet-outline",
  "ri-book-2-line": "book-outline",
  "ri-book-open-line": "book-outline",
  "ri-archive-line": "archive-outline",
  "ri-line-chart-line": "trending-up-outline",
  "ri-lock-2-line": "lock-closed-outline",
  "ri-calendar-close-line": "calendar-outline",
  "ri-computer-line": "desktop-outline",
  "ri-government-line": "flag-outline",
  "ri-bar-chart-box-line": "bar-chart-outline",
  "ri-building-line": "business-outline",
  "ri-shield-user-line": "shield-outline",
  "ri-menu-line": "menu-outline",
  "ri-person-outline": "person-outline",
  "ri-settings-outline": "settings-outline",
  "ri-log-out-outline": "log-out-outline",
};

export function remixToIonicon(icon?: string): IonName {
  if (!icon) return "ellipse-outline";
  return REMIX_TO_ION[icon] ?? "chevron-forward-outline";
}
