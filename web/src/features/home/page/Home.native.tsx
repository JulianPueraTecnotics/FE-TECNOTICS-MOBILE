import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocation, useNavigate } from "react-router-dom";
import { Ionicons } from "@expo/vector-icons";
import logo from "../../../assets/logo.png";
import hero1 from "../../../assets/WEBFACTURACIONELECTRONICA-01.jpg.jpeg";
import hero2 from "../../../assets/WEBFACTURACIONELECTRONICA-02.jpg.jpeg";
import hero3 from "../../../assets/WEBFACTURACIONELECTRONICA-03.jpg.jpeg";
import img09 from "../../../assets/WEBFACTURACIONELECTRONICA-09.png";
import img10 from "../../../assets/WEBFACTURACIONELECTRONICA-10.png";
import AccentStrip from "../../../components/mobile/AccentStrip.native";
import { getSoftCardShadow, SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { PATHS } from "../../../router/paths.contants";
import { AuthContext } from "../../../store/auth.context";
import { useTheme } from "../../../store/theme.context";
import { useThemeColors } from "../../../theme/useThemeColors";
import type { NativeThemeColors } from "../../../theme/theme.native";
import {
  CONTROL_BENEFITS,
  FAQ_ITEMS,
  FEATURE_CARDS,
  INTRO_BENEFITS,
  PLAN_CARDS,
  STEPS,
} from "./home.content";

const HERO_IMAGES = [hero1, hero2, hero3];

const SOCIAL_LINKS = [
  { icon: "logo-whatsapp" as const, url: "https://wa.me/573185078721", aria: "WhatsApp" },
  { icon: "logo-instagram" as const, url: "https://www.instagram.com/tecnotics_sas", aria: "Instagram" },
  { icon: "logo-linkedin" as const, url: "https://www.linkedin.com/company/tecnotics", aria: "LinkedIn" },
] as const;

function createStyles(c: NativeThemeColors) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: c.pageBg },
    scroll: { paddingBottom: 32 },
    hero: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
    heroImages: {
      flexDirection: "row",
      height: 160,
      borderRadius: 12,
      overflow: "hidden",
    },
    heroImage: { flex: 1, height: "100%" },
    heroContent: { marginTop: 24, alignItems: "center", paddingHorizontal: 4 },
    heroTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: c.primaryText,
      textAlign: "center",
      lineHeight: 30,
      marginBottom: 12,
    },
    heroSubtitle: {
      fontSize: 15,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 20,
    },
    cta: {
      backgroundColor: c.accent,
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: 24,
    },
    ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    section: {
      paddingHorizontal: 16,
      paddingVertical: 28,
      backgroundColor: c.pageBg,
    },
    sectionAlt: {
      paddingHorizontal: 16,
      paddingVertical: 28,
      backgroundColor: c.bgSubtle,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: c.primary,
      textAlign: "center",
      marginBottom: 10,
    },
    sectionSubtitle: {
      fontSize: 15,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 20,
    },
    featuresGrid: { gap: 16, marginBottom: 28 },
    featureCard: {
      backgroundColor: c.cardBg,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
    },
    featureIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(90, 159, 180, 0.15)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      alignSelf: "center",
    },
    featureTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: c.primary,
      marginBottom: 8,
      textAlign: "center",
    },
    featureText: { fontSize: 14, color: c.textMuted, lineHeight: 20, textAlign: "center" },
    sectionImage: {
      width: "100%",
      height: 220,
      marginBottom: 20,
      borderRadius: 8,
    },
    benefitsList: { gap: 10 },
    benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    checkMark: { color: c.accent, fontWeight: "700", fontSize: 16, marginTop: 1 },
    benefitText: { flex: 1, fontSize: 14, color: c.primaryText, lineHeight: 20 },
    stepCard: { alignItems: "center", marginBottom: 24, position: "relative" },
    stepIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    stepConnector: {
      position: "absolute",
      top: 56,
      width: 2,
      height: 24,
      backgroundColor: c.accent,
      opacity: 0.4,
    },
    stepTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: c.accent,
      textAlign: "center",
      marginBottom: 6,
    },
    stepDesc: {
      fontSize: 14,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 20,
      paddingHorizontal: 8,
    },
    planCard: {
      backgroundColor: c.cardBg,
      borderRadius: 16,
      padding: 20,
      marginTop: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    planCardPopular: { borderColor: c.accent, borderWidth: 2 },
    planBadge: {
      alignSelf: "flex-start",
      backgroundColor: c.accent,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      marginBottom: 10,
    },
    planBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    planName: { fontSize: 20, fontWeight: "700", color: c.primary, marginBottom: 6 },
    planDesc: { fontSize: 14, color: c.textMuted, marginBottom: 14, lineHeight: 20 },
    planPricePill: {
      alignSelf: "flex-start",
      backgroundColor: c.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 16,
    },
    planPriceText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    planCustomFields: { gap: 10, marginBottom: 16 },
    planSelectWrap: { gap: 4 },
    planSelectLabel: { fontSize: 13, color: c.textMuted, fontWeight: "600" },
    planSelect: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: c.bgSubtle,
    },
    planSelectValue: { color: c.textMuted, fontSize: 14 },
    planIncludesLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: c.accent,
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    planFeatureRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
    planFeatureText: { flex: 1, fontSize: 13, color: c.primaryText, lineHeight: 18 },
    planCta: {
      marginTop: 16,
      backgroundColor: c.accent,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
    },
    planCtaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    faqBox: {
      marginTop: 16,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      overflow: "hidden",
    },
    faqItem: { borderBottomWidth: 1, borderBottomColor: c.border },
    faqItemOpen: { backgroundColor: c.bgSubtle },
    faqQuestion: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      gap: 12,
    },
    faqQuestionText: { flex: 1, fontSize: 15, fontWeight: "600", color: c.primary },
    faqChevron: { fontSize: 12, color: c.textMuted },
    faqChevronOpen: { transform: [{ rotate: "180deg" }] },
    faqAnswer: { paddingHorizontal: 16, paddingBottom: 16 },
    faqAnswerText: { fontSize: 14, color: c.textMuted, lineHeight: 21 },
    footer: {
      backgroundColor: c.pageBg,
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginTop: 4,
      paddingHorizontal: 16,
      paddingTop: 22,
      paddingBottom: 14,
      position: "relative",
      overflow: "hidden",
    },
    footerAccent: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    },
    footerInner: { paddingTop: 6 },
    footerBlock: { alignItems: "center", marginBottom: 14, gap: 6 },
    footerTitle: {
      color: c.primaryText,
      fontSize: 15,
      fontWeight: "700",
      textAlign: "center",
    },
    footerTitleUnderline: {
      width: 32,
      height: 2,
      borderRadius: 2,
      backgroundColor: c.accent,
      alignSelf: "center",
      marginTop: 4,
      marginBottom: 2,
    },
    footerSocialRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
    socialBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.cardBg,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    footerDivider: {
      height: 1,
      marginVertical: 12,
      backgroundColor: c.border,
      width: "100%",
    },
    footerLink: {
      color: c.primaryText,
      fontSize: 14,
      paddingVertical: 5,
      paddingHorizontal: 12,
      textAlign: "center",
      borderRadius: SHELL_RADIUS.button,
    },
    footerDevLabel: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: "500",
      marginBottom: 4,
    },
    footerLogo: { width: 120, height: 32 },
    footerLogoDark: { tintColor: "#e6edf3" },
  });
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const { theme } = useTheme();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const pendingHash = useRef<string | null>(null);
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);

  const tryScrollToPending = () => {
    if (!pendingHash.current) return;
    const y = sectionOffsets.current[pendingHash.current];
    if (y != null) {
      scrollRef.current?.scrollTo({ y, animated: true });
      pendingHash.current = null;
    }
  };

  useEffect(() => {
    if (user) {
      navigate(user.role === "super_admin" ? PATHS.ADMIN_HOME : PATHS.DASHBOARD, {
        replace: true,
      });
    }
  }, [user, navigate]);

  useEffect(() => {
    const hash = location.hash?.replace("#", "");
    if (hash) pendingHash.current = hash;
    tryScrollToPending();
  }, [location.pathname, location.hash]);

  const registerSection =
    (id: string) =>
    (e: { nativeEvent: { layout: { y: number } } }) => {
      sectionOffsets.current[id] = e.nativeEvent.layout.y;
      tryScrollToPending();
    };

  const scrollToSection = (id: string) => {
    const y = sectionOffsets.current[id];
    if (y != null) scrollRef.current?.scrollTo({ y, animated: true });
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <ScrollView ref={scrollRef} style={styles.page} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <View style={styles.heroImages}>
          {HERO_IMAGES.map((src, i) => (
            <Image key={i} source={src} style={styles.heroImage} resizeMode="cover" />
          ))}
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>
            Factura electronicamente sin{"\n"}complicaciones.
          </Text>
          <Text style={styles.heroSubtitle}>
            Nuestra plataforma de facturación electrónica en la nube te permite emitir, enviar y
            gestionar tus facturas de forma rápida, segura y 100% compatible con la normativa de la
            DIAN.
          </Text>
          <Pressable style={styles.cta} onPress={() => navigate(PATHS.REGISTER)}>
            <Text style={styles.ctaText}>Comenzar ahora</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.featuresGrid}>
          {FEATURE_CARDS.map((card) => (
            <View key={card.title} style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Ionicons name={card.icon} size={24} color={colors.accent} />
              </View>
              <Text style={styles.featureTitle}>{card.title}</Text>
              <Text style={styles.featureText}>{card.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Facturación Electrónica Inteligente</Text>
        <Text style={styles.sectionSubtitle}>
          Emite, gestiona y controla tu facturación electrónica de forma simple, rápida y segura
          cumpliendo con la normativa de la DIAN.
        </Text>
        <Image source={img09} style={styles.sectionImage} resizeMode="contain" />
        <View style={styles.benefitsList}>
          {INTRO_BENEFITS.map((item) => (
            <View key={item} style={styles.benefitRow}>
              <Text style={styles.checkMark}>✓</Text>
              <Text style={styles.benefitText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionAlt}>
        <Text style={styles.sectionTitle}>Control total de tu facturación</Text>
        <Text style={styles.sectionSubtitle}>
          Administra toda tu información desde un solo lugar con herramientas diseñadas para
          simplificar tu gestión empresarial.
        </Text>
        <Image source={img10} style={styles.sectionImage} resizeMode="contain" />
        <View style={styles.benefitsList}>
          {CONTROL_BENEFITS.map((item) => (
            <View key={item} style={styles.benefitRow}>
              <Text style={styles.checkMark}>✓</Text>
              <Text style={styles.benefitText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View
        style={styles.section}
        onLayout={registerSection("como-funciona")}
        nativeID="como-funciona"
      >
        <Text style={styles.sectionTitle}>Emite tu facturación electrónica en 4 pasos</Text>
        <Text style={styles.sectionSubtitle}>
          Un proceso simple para cumplir con la DIAN y gestionar tu facturación sin complicaciones.
        </Text>
        {STEPS.map((step, index) => (
          <View key={step.title} style={styles.stepCard}>
            <View style={styles.stepIconWrap}>
              <Ionicons name={step.icon} size={26} color="#ffffff" />
            </View>
            {index < STEPS.length - 1 && <View style={styles.stepConnector} />}
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDesc}>{step.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionAlt} onLayout={registerSection("planes")} nativeID="planes">
        <Text style={styles.sectionTitle}>Elige el plan que se adapta a tu negocio</Text>
        {PLAN_CARDS.map((plan) => (
          <View
            key={plan.name}
            style={[styles.planCard, plan.popular && styles.planCardPopular]}
          >
            {plan.popular && (
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>MÁS POPULAR</Text>
              </View>
            )}
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planDesc}>{plan.desc}</Text>
            {"custom" in plan && plan.custom ? (
              <View style={styles.planCustomFields}>
                <View style={styles.planSelectWrap}>
                  <Text style={styles.planSelectLabel}>Documentos electrónicos</Text>
                  <View style={styles.planSelect}>
                    <Text style={styles.planSelectValue}>Seleccionar</Text>
                  </View>
                </View>
                <View style={styles.planSelectWrap}>
                  <Text style={styles.planSelectLabel}>Usuarios</Text>
                  <View style={styles.planSelect}>
                    <Text style={styles.planSelectValue}>Seleccionar</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.planPricePill}>
                <Text style={styles.planPriceText}>{plan.price}</Text>
              </View>
            )}
            <Text style={styles.planIncludesLabel}>QUE INCLUYE</Text>
            {plan.features.map((feature) => (
              <View key={feature} style={styles.planFeatureRow}>
                <Text style={styles.checkMark}>✓</Text>
                <Text style={styles.planFeatureText}>{feature}</Text>
              </View>
            ))}
            <Pressable style={styles.planCta} onPress={() => navigate(PATHS.REGISTER)}>
              <Text style={styles.planCtaText}>Seleccionar plan</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Explora las preguntas frecuentes</Text>
        <View style={styles.faqBox}>
          {FAQ_ITEMS.map((item, index) => {
            const open = faqOpenIndex === index;
            return (
              <View key={item.question} style={[styles.faqItem, open && styles.faqItemOpen]}>
                <Pressable
                  style={styles.faqQuestion}
                  onPress={() => setFaqOpenIndex(open ? null : index)}
                >
                  <Text style={styles.faqQuestionText}>{item.question}</Text>
                  <Text style={[styles.faqChevron, open && styles.faqChevronOpen]}>▼</Text>
                </Pressable>
                {open && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{item.answer}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Footer estilo ACTIVA — bordes, franja y tarjetas sociales */}
      <View style={styles.footer}>
        <View style={styles.footerAccent}>
          <AccentStrip height={2} opacity={0.8} />
        </View>

        <View style={styles.footerInner}>
          <View style={styles.footerBlock}>
            <Text style={styles.footerTitle}>Redes sociales</Text>
            <View style={styles.footerTitleUnderline} />
            <View style={styles.footerSocialRow}>
              {SOCIAL_LINKS.map((s) => (
                <Pressable
                  key={s.url}
                  style={[styles.socialBtn, getSoftCardShadow(colors)]}
                  onPress={() => openUrl(s.url)}
                  accessibilityLabel={s.aria}
                >
                  <Ionicons name={s.icon} size={18} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.footerDivider, { backgroundColor: colors.border }]} />

          <View style={styles.footerBlock}>
            <Text style={styles.footerTitle}>Acciones rápidas</Text>
            <View style={styles.footerTitleUnderline} />
            <Pressable onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}>
              <Text style={styles.footerLink}>Inicio</Text>
            </Pressable>
            <Pressable onPress={() => scrollToSection("como-funciona")}>
              <Text style={styles.footerLink}>Cómo funciona</Text>
            </Pressable>
            <Pressable onPress={() => scrollToSection("planes")}>
              <Text style={styles.footerLink}>Planes</Text>
            </Pressable>
            <Pressable onPress={() => navigate(PATHS.LOGIN)}>
              <Text style={styles.footerLink}>Iniciar sesión</Text>
            </Pressable>
            <Pressable onPress={() => navigate(PATHS.REGISTER)}>
              <Text style={styles.footerLink}>Registrarse</Text>
            </Pressable>
            <Pressable onPress={() => navigate(PATHS.FORGOT_PASSWORD)}>
              <Text style={styles.footerLink}>Recuperar contraseña</Text>
            </Pressable>
          </View>

          <View style={[styles.footerDivider, { backgroundColor: colors.border }]} />

          <View style={styles.footerBlock}>
            <Text style={styles.footerDevLabel}>Desarrollado por</Text>
            <Pressable onPress={() => openUrl("https://tecnotics.com")}>
              <Image
                source={logo}
                style={[styles.footerLogo, theme === "dark" && styles.footerLogoDark]}
                resizeMode="contain"
              />
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default HomePage;
