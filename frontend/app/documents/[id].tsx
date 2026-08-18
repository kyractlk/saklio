import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable, FlatList, Modal, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn, SlideInDown } from "react-native-reanimated";
import { Screen, Header, EmptyState } from "@/src/components/layout";
import { AppText, Button, Skeleton } from "@/src/components/ui";
import { useFileUrl } from "@/src/components/ProductCard";
import { CalendarIllustration } from "@/src/components/Illustrations";
import { useTheme, spacing, radius } from "@/src/theme";
import { api, uploadImage } from "@/src/api/client";
import { formatDate, haptic } from "@/src/lib/format";

const DOC_TYPES = [
  { key: "fis", label: "Fiş", icon: "file-text", color: "#68B58A" },
  { key: "fatura", label: "Fatura", icon: "file", color: "#5B9F7D" },
  { key: "garanti", label: "Garanti", icon: "shield", color: "#6C93D6" },
  { key: "kilavuz", label: "Kullanım Kılavuzu", icon: "book-open", color: "#E9B75C" },
  { key: "servis", label: "Servis Belgesi", icon: "tool", color: "#DF7C76" },
];

function typeMeta(key: string) {
  return DOC_TYPES.find((t) => t.key === key) || DOC_TYPES[0];
}

export default function Documents() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("fis");
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<any>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const load = useCallback(async () => {
    try {
      const d = await api.listDocuments(id);
      setDocs(d as any[]);
    } catch {}
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const uploadFrom = async (source: "camera" | "gallery") => {
    let result: ImagePicker.ImagePickerResult;
    if (source === "camera") {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) return;
      }
      result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    }
    if (result.canceled || !result.assets[0]) return;
    await doUpload(result.assets[0].uri);
  };

  const uploadFromFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["image/*"], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    await doUpload(res.assets[0].uri);
  };

  const doUpload = async (uri: string) => {
    setUploading(true);
    haptic.medium();
    try {
      const path = await uploadImage(uri);
      await api.addDocument(id, { type: selectedType, name: typeMeta(selectedType).label, file_path: path });
      haptic.success();
      setSheetOpen(false);
      load();
    } catch {
      haptic.error();
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen>
      <Header title="Belgeler" subtitle="Fiş, fatura, garanti ve kılavuzlar" onBack={() => router.back()} />
      {loading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={78} radius={20} />
          ))}
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ paddingTop: 40 }}>
              <EmptyState
                illustration={<CalendarIllustration size={160} brand={colors.brand} ink={colors.onSurface} />}
                title="Henüz belge yok"
                body="Bu ürüne fiş, garanti veya kullanım kılavuzu ekleyerek her şeyi tek yerde tut."
                cta="Belge ekle"
                onCta={() => {
                  haptic.light();
                  setSheetOpen(true);
                }}
              />
            </View>
          }
          renderItem={({ item, index }) => <DocCard doc={item} index={index} onPress={() => setViewer(item)} onDelete={async () => {
            haptic.warning();
            await api.deleteDocument(item.id);
            load();
          }} />}
        />
      )}

      {/* Floating add button */}
      {docs.length > 0 && (
        <Pressable
          testID="add-document-fab"
          onPress={() => {
            haptic.medium();
            setSheetOpen(true);
          }}
          style={[styles.fab, { backgroundColor: colors.brand, bottom: (insets.bottom || 0) + 20 }]}
        >
          <Feather name="plus" size={26} color={colors.onBrand} />
        </Pressable>
      )}

      {/* Add sheet */}
      <Modal visible={sheetOpen} transparent animationType="fade" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => !uploading && setSheetOpen(false)} />
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: (insets.bottom || spacing.lg) + spacing.md }]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <AppText variant="section" style={{ marginBottom: spacing.md }}>
            Belge türü seç
          </AppText>
          <View style={{ gap: spacing.sm }}>
            {DOC_TYPES.map((t) => {
              const active = selectedType === t.key;
              return (
                <Pressable
                  key={t.key}
                  testID={`doctype-${t.key}`}
                  onPress={() => {
                    haptic.light();
                    setSelectedType(t.key);
                  }}
                  style={[
                    styles.typeRow,
                    { backgroundColor: colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border, borderWidth: active ? 2 : 1 },
                  ]}
                >
                  <View style={[styles.typeIcon, { backgroundColor: t.color + "22" }]}>
                    <Feather name={t.icon as any} size={18} color={t.color} />
                  </View>
                  <AppText variant="body" style={{ flex: 1 }}>
                    {t.label}
                  </AppText>
                  {active ? <Feather name="check-circle" size={20} color={colors.brand} /> : null}
                </Pressable>
              );
            })}
          </View>

          {uploading ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <ActivityIndicator color={colors.brand} />
              <AppText variant="caption" color={colors.mutedText} style={{ marginTop: spacing.sm }}>
                Yükleniyor…
              </AppText>
            </View>
          ) : (
            <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <Button
                  testID="doc-camera"
                  title="Kamera"
                  variant="secondary"
                  icon={<Feather name="camera" size={18} color={colors.onSurface} />}
                  onPress={() => uploadFrom("camera")}
                  style={{ flex: 1 }}
                />
                <Button
                  testID="doc-gallery"
                  title="Galeri"
                  variant="secondary"
                  icon={<Feather name="image" size={18} color={colors.onSurface} />}
                  onPress={() => uploadFrom("gallery")}
                  style={{ flex: 1 }}
                />
              </View>
              <Button
                testID="doc-files"
                title="Dosyalardan seç"
                icon={<Feather name="folder" size={18} color={colors.onBrand} />}
                onPress={uploadFromFiles}
              />
            </View>
          )}
        </Animated.View>
      </Modal>

      {/* Viewer */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <DocViewer doc={viewer} onClose={() => setViewer(null)} />
      </Modal>
    </Screen>
  );
}

function DocCard({ doc, index, onPress, onDelete }: any) {
  const { colors } = useTheme();
  const meta = typeMeta(doc.type);
  const url = useFileUrl(doc.file_path);
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable
        testID={`doc-${doc.id}`}
        onPress={() => {
          haptic.light();
          onPress();
        }}
        style={[styles.docCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      >
        {url ? (
          <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: meta.color + "22", alignItems: "center", justifyContent: "center" }]}>
            <Feather name={meta.icon as any} size={22} color={meta.color} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <AppText variant="card">{meta.label}</AppText>
          <AppText variant="caption" color={colors.mutedText}>
            {formatDate(doc.created_at)}
          </AppText>
        </View>
        <Pressable testID={`doc-delete-${doc.id}`} onPress={onDelete} hitSlop={10} style={{ padding: 6 }}>
          <Feather name="trash-2" size={18} color={colors.mutedText} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function DocViewer({ doc, onClose }: any) {
  const url = useFileUrl(doc?.file_path);
  return (
    <View style={styles.viewer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <SafeAreaView edges={["top"]} style={{ alignItems: "flex-end", padding: spacing.lg, width: "100%" }}>
        <Pressable testID="viewer-close" onPress={onClose} style={styles.viewerClose}>
          <Feather name="x" size={24} color="#fff" />
        </Pressable>
      </SafeAreaView>
      {url ? (
        <Animated.View entering={FadeIn} style={{ flex: 1, width: "100%", justifyContent: "center", padding: spacing.md }}>
          <Image source={{ uri: url }} style={{ width: "100%", height: "80%" }} contentFit="contain" />
        </Animated.View>
      ) : (
        <ActivityIndicator color="#fff" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: spacing.md },
  typeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  typeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  docCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1 },
  thumb: { width: 56, height: 56, borderRadius: radius.md },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)" },
  viewerClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});
