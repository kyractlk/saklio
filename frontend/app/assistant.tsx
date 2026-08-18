import React, { useEffect, useRef, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Screen, Header } from "@/src/components/layout";
import { AppText } from "@/src/components/ui";
import { SaklioLogo } from "@/src/components/Illustrations";
import { useTheme, spacing, radius } from "@/src/theme";
import { api } from "@/src/api/client";
import { haptic } from "@/src/lib/format";

const QUICK = ["Neyi iade edebilirim?", "Garantisi biten ürünlerim?", "En pahalı eşyam ne?"];

interface Msg {
  role: "user" | "assistant";
  text: string;
}

export default function Assistant() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    api
      .assistantHistory()
      .then((h: any) => setMessages(h.map((m: any) => ({ role: m.role, text: m.text }))))
      .catch(() => {});
  }, []);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    haptic.light();
    const userMsg: Msg = { role: "user", text: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res: any = await api.assistantChat(text.trim());
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Şu an yanıt veremiyorum, birazdan tekrar dene." }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <Screen edges={["top"]}>
      <Header title="Saklio Asistan" subtitle="Eşyaların hakkında her şeyi sor" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior="translate-with-padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: spacing.xl }}>
              <SaklioLogo size={56} color={colors.brandDark} accent={colors.brand} />
              <AppText variant="section" style={{ marginTop: spacing.md, textAlign: "center" }}>
                Merhaba, ben Saklio Asistan
              </AppText>
              <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm, textAlign: "center" }}>
                İade, garanti ve eşyaların hakkında soru sor.
              </AppText>
            </View>
          ) : (
            messages.map((m, i) => (
              <Animated.View
                key={i}
                entering={FadeInUp.duration(250)}
                style={[
                  styles.bubble,
                  m.role === "user"
                    ? { backgroundColor: colors.brand, alignSelf: "flex-end", borderBottomRightRadius: 4 }
                    : { backgroundColor: colors.surfaceSecondary, alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
                ]}
              >
                <AppText variant="body" color={m.role === "user" ? colors.onBrand : colors.onSurface} style={{ lineHeight: 21 }}>
                  {m.text}
                </AppText>
              </Animated.View>
            ))
          )}
          {sending ? (
            <View style={[styles.bubble, { backgroundColor: colors.surfaceSecondary, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.brandDark} size="small" />
            </View>
          ) : null}
        </ScrollView>

        {/* Quick actions */}
        {messages.length === 0 && (
          <View style={{ height: 48, justifyContent: "center" }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}
            >
              {QUICK.map((q) => (
                <Pressable
                  key={q}
                  testID={`quick-${q}`}
                  onPress={() => send(q)}
                  style={[styles.quickChip, { backgroundColor: colors.surfaceTertiary }]}
                >
                  <AppText variant="caption" color={colors.brandDark} weight="medium">
                    {q}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: (insets.bottom || spacing.md) }]}>
          <View style={[styles.inputWrap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <TextInput
              testID="assistant-input"
              style={{ flex: 1, color: colors.onSurface, fontSize: 16, maxHeight: 100 }}
              placeholder="Bir şey sor…"
              placeholderTextColor={colors.mutedText}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <Pressable
              testID="assistant-send"
              onPress={() => send(input)}
              disabled={!input.trim() || sending}
              style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.brand : colors.border }]}
            >
              <Feather name="arrow-up" size={20} color={input.trim() ? colors.onBrand : colors.mutedText} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "82%", padding: spacing.md, borderRadius: radius.lg },
  quickChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, flexShrink: 0 },
  inputBar: { borderTopWidth: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
