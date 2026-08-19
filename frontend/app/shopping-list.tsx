import React, { useCallback, useState } from "react";
import { View, Pressable, StyleSheet, FlatList } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Screen, Header, EmptyState } from "@/src/components/layout";
import { AppText, Button, Input } from "@/src/components/ui";
import { EmptyBoxIllustration } from "@/src/components/Illustrations";
import { AystechMark } from "@/src/components/AystechMark";
import { useTheme, spacing, radius } from "@/src/theme";
import { useT } from "@/src/i18n";
import { api } from "@/src/api/client";
import { haptic } from "@/src/lib/format";
import { shoppingListHtml, shoppingListText } from "@/src/lib/email-templates";

export default function ShoppingList() {
  const { colors } = useTheme();
  const { t, lang } = useT();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      setItems((await api.listShopping()) as any[]);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const add = async () => {
    if (!name.trim()) return;
    haptic.light();
    try {
      await api.addShoppingItem({ name: name.trim(), qty: qty.trim() });
      setName("");
      setQty("");
      load();
    } catch {
      haptic.error();
    }
  };

  const toggle = async (item: any) => {
    haptic.light();
    await api.updateShoppingItem(item.id, { checked: !item.checked });
    load();
  };

  const remove = async (id: string) => {
    haptic.warning();
    await api.deleteShoppingItem(id);
    load();
  };

  const payload = items.map((i) => ({ name: i.name, qty: i.qty, checked: i.checked }));

  const emailMe = async () => {
    haptic.medium();
    const html = shoppingListHtml(lang, payload);
    setBusy(true);
    try {
      await api.sendMyEmail({
        subject: t("shoppingList"),
        html,
        text: shoppingListText(lang, payload),
        createPdf: true,
        pdfFilename: "saklio-alisveris.pdf",
      });
      setMsg(t("listMailed"));
    } catch {
      haptic.error();
      setMsg(t("listSent"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={t("shoppingList")} subtitle={t("shoppingSub")} onBack={() => router.back()} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={{ paddingTop: 24 }}>
            <EmptyState
              illustration={<EmptyBoxIllustration size={140} brand={colors.brand} ink={colors.onSurface} />}
              title={t("shoppingEmptyT")}
              body={t("shoppingEmptyB")}
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Pressable testID={`shop-check-${item.id}`} onPress={() => toggle(item)} style={styles.check}>
              <Feather
                name={item.checked ? "check-square" : "square"}
                size={22}
                color={item.checked ? colors.brandDark : colors.mutedText}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <AppText variant="body" style={{ textDecorationLine: item.checked ? "line-through" : "none" }}>
                {item.name}
              </AppText>
              {item.qty ? (
                <AppText variant="caption" color={colors.mutedText}>
                  {item.qty}
                </AppText>
              ) : null}
            </View>
            <Pressable testID={`shop-del-${item.id}`} onPress={() => remove(item.id)} hitSlop={10}>
              <Feather name="trash-2" size={18} color={colors.mutedText} />
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <Input testID="shop-name" label={t("itemName")} value={name} onChangeText={setName} placeholder={t("addItem")} />
            <Input testID="shop-qty" label={t("qty")} value={qty} onChangeText={setQty} placeholder="1" />
            <Button testID="shop-add" title={t("addItem")} onPress={add} />
            <Button testID="shop-mail" title={t("emailMeList")} variant="secondary" onPress={emailMe} loading={busy} />
            {msg ? (
              <AppText variant="caption" color={colors.brandDark} style={{ textAlign: "center" }}>
                {msg}
              </AppText>
            ) : null}
            <AystechMark compact />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  check: { padding: 4 },
});
