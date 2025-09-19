import React from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: (tier: "core" | "studio") => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  visible,
  onClose,
  onUpgrade,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Upgrade Your Atlas Experience</Text>
          <Text style={styles.subtitle}>
            Unlock powerful features to support your emotional journey.
          </Text>

          <ScrollView style={{ marginVertical: 16 }}>
            {/* Core Plan */}
            <View style={styles.planCard}>
              <Text style={styles.planTitle}>🌱 Core</Text>
              <Text style={styles.planPrice}>$19.99 / month</Text>
              <Text style={styles.planDesc}>
                • Unlimited messages{"\n"}
                • Claude Sonnet access{"\n"}
                • Persistent memory{"\n"}
                • EQ challenges
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => onUpgrade("core")}
              >
                <Text style={styles.buttonText}>Upgrade to Core</Text>
              </TouchableOpacity>
            </View>

            {/* Studio Plan */}
            <View style={styles.planCard}>
              <Text style={styles.planTitle}>🚀 Studio</Text>
              <Text style={styles.planPrice}>$179.99 / month</Text>
              <Text style={styles.planDesc}>
                • Everything in Core{"\n"}
                • Claude Opus access{"\n"}
                • Advanced analytics{"\n"}
                • Priority processing{"\n"}
                • Premium insights
              </Text>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#B2BDA3" }]}
                onPress={() => onUpgrade("studio")}
              >
                <Text style={styles.buttonText}>Upgrade to Studio</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Brand colors
const BRAND = "#B2BDA3";
const ACCENT = "#F4E5D9";

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: BRAND,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  planCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: BRAND,
  },
  planPrice: {
    fontSize: 16,
    fontWeight: "500",
    marginVertical: 6,
    color: "#444",
  },
  planDesc: {
    fontSize: 14,
    color: "#555",
    marginBottom: 12,
  },
  button: {
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: "600",
  },
  closeButton: {
    marginTop: 10,
    alignItems: "center",
  },
  closeText: {
    color: "#666",
    fontSize: 14,
  },
});