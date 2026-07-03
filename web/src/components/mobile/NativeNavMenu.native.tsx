import { Ionicons } from "@expo/vector-icons";
import { useContext, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../store/auth.context";
import { canAccessPath, getHomePathForRole, getPathnameFromRoute } from "../../router/routeAccess";
import { useThemeColors } from "../../theme/useThemeColors";
import {
  COMPANY_MENU,
  filterMenuByRole,
  isGroupActive,
  type MenuItem,
} from "../shared/nav/menu.config";
import { remixToIonicon } from "./mobileNavIcons.native";
import { SHELL_RADIUS } from "./shellStyles.native";

type Props = {
  onNavigate?: () => void;
};

function isPathActive(pathname: string, search: string, itemPath: string): boolean {
  const [base, query] = itemPath.split("?");
  if (base === "/dashboard") return pathname === "/dashboard";
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
  if (query) {
    const expected = query.startsWith("?") ? query : `?${query}`;
    return search === expected || search.includes(query.replace(/^\?/, ""));
  }
  return pathname === base || pathname.startsWith(`${base}/`);
}

export default function NativeNavMenu({ onNavigate }: Props) {
  const { user } = useContext(AuthContext);
  const colors = useThemeColors();
  const navigate = useNavigate();
  const location = useLocation();
  const items = useMemo(
    () => filterMenuByRole(COMPANY_MENU, user?.role ?? null),
    [user?.role]
  );

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    items.forEach((item) => {
      if (item.children && isGroupActive(item, location.pathname)) {
        initial.add(item.label);
      }
    });
    return initial;
  });

  const go = (path: string) => {
    const pathname = getPathnameFromRoute(path);
    if (!canAccessPath(user?.role ?? null, pathname)) {
      onNavigate?.();
      navigate(getHomePathForRole(user?.role ?? null));
      return;
    }
    onNavigate?.();
    const [base, query] = path.split("?");
    if (query) {
      navigate({ pathname: base, search: `?${query}` });
      return;
    }
    navigate(path);
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const renderLeaf = (item: MenuItem, isChild: boolean) => {
    if (!item.path) return null;
    const active = isPathActive(location.pathname, location.search, item.path);
    return (
      <Pressable
        key={`${item.label}-${item.path}`}
        style={[
          styles.link,
          isChild ? styles.linkChild : null,
          active
            ? { backgroundColor: colors.headerAccent }
            : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        ]}
        onPress={() => go(item.path!)}
      >
        <Ionicons
          name={remixToIonicon(item.icon)}
          size={isChild ? 18 : 20}
          color={active ? "#fff" : colors.textMuted}
        />
        <Text
          style={[
            styles.linkText,
            { color: active ? "#fff" : colors.primaryText },
            active ? styles.linkTextActive : null,
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.menu}>
      {items.map((item) => {
        if (!item.children) {
          return renderLeaf(item, false);
        }

        const open = openGroups.has(item.label) || isGroupActive(item, location.pathname);
        return (
          <View key={item.label} style={styles.group}>
            <Pressable
              style={[styles.groupToggle, { borderColor: colors.border }]}
              onPress={() => toggleGroup(item.label)}
            >
              <Ionicons name={remixToIonicon(item.icon)} size={20} color={colors.accent} />
              <Text style={[styles.groupLabel, { color: colors.primaryText }]}>{item.label}</Text>
              <Ionicons
                name={open ? "chevron-up-outline" : "chevron-down-outline"}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
            {open ? (
              <View style={styles.submenu}>{item.children.map((child) => renderLeaf(child, true))}</View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { gap: 4 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.menuItem,
  },
  linkChild: {
    paddingLeft: 22,
    minHeight: 44,
  },
  linkText: { fontSize: 15, fontWeight: "500", flex: 1 },
  linkTextActive: { fontWeight: "700" },
  group: { marginBottom: 2 },
  groupToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.menuItem,
    borderWidth: StyleSheet.hairlineWidth,
  },
  groupLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
  submenu: { marginTop: 4, gap: 2 },
});
