import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppText, Chip } from "./ui";
import { useTheme, CATEGORY_COLORS, radius, spacing } from "@/src/theme";
import { formatPrice, formatDate, daysLabel, haptic } from "@/src/lib/format";
import { fileUrl } from "@/src/api/client";

const CATEGORY_ICON: Record<string, any> = {
  elektronik: "cpu",
  moda: "shopping-bag",
  ev: "home",
  otomotiv: "truck",
  diger: "box",
};

export function useFileUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (path) {
      fileUrl(path).then((u) => active && setUrl(u));
    } else {
      setUrl(null);
    }
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}

export function ProductThumb({
  path,
  imageUrl,
  category,
  size = 64,
}: {
  path?: string | null;
  imageUrl?: string | null;
  category: string;
  size?: number;
}) {
  const url = useFileUrl(path);
  const finalUrl = url || imageUrl || null;
  const cat = CATEGORY_COLORS[category] || CATEGORY_COLORS.diger;
  if (finalUrl) {
    return (
      <Image
        source={{ uri: finalUrl }}
        style={{ width: size, height: size, borderRadius: radius.md }}
        contentFit="cover"
        transition={200}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: cat.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name={CATEGORY_ICON[category] || "box"} size={size * 0.38} color={cat.fg} />
    </View>
  );
}

export function StatusChips({ product }: { product: any }) {
  const { colors } = useTheme();
  const chips: { label: string; bg: string; fg: string }[] = [];
  if (product.return_status === "active" || product.return_status === "ending") {
    chips.push({ label: "İade edilebilir", bg: "rgba(104,181,138,0.18)", fg: colors.success });
  }
  if (product.warranty_status === "active" || product.warranty_status === "ending") {
    chips.push({ label: "Garanti aktif", bg: "rgba(143,207,174,0.2)", fg: colors.brandDark });
  }
  if (product.receipt_path || product.image_path) {
    chips.push({ label: "Fiş kayıtlı", bg: colors.surfaceTertiary, fg: colors.brandDark });
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      {chips.map((c, i) => (
        <Chip key={i} label={c.label} bg={c.bg} color={c.fg} />
      ))}
    </View>
  );
}

export function ProductCard({
  product,
  onPress,
  index = 0,
}: {
  product: any;
  onPress: () => void;
  index?: number;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(16)}>
      <Pressable
        testID={`product-card-${product.id}`}
        onPress={() => {
          haptic.light();
          onPress();
        }}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.border,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <ProductThumb path={product.image_path} imageUrl={product.image_url} category={product.category} size={64} />
        <View style={{ flex: 1 }}>
          <AppText variant="card" numberOfLines={1}>
            {product.name}
          </AppText>
          <AppText variant="caption" color={colors.mutedText}>
            {product.merchant || "Bilinmiyor"} · {formatDate(product.purchase_date)}
          </AppText>
          <StatusChips product={product} />
        </View>
        <View style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
          <AppText variant="body" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
            {formatPrice(product.price, product.currency)}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
});
