import { describe, expect, it } from "vitest";
import { formatTime24Digits, normalizeTime24OnBlur } from "./time-input-24h";

describe("TimeInput24h helpers", () => {
  describe("formatTime24Digits", () => {
    it("permite digitação de dígitos de hora", () => {
      expect(formatTime24Digits("1")).toBe("1");
      expect(formatTime24Digits("14")).toBe("14");
    });

    it("insere dois-pontos e limita a hora a 23", () => {
      expect(formatTime24Digits("143")).toBe("14:3");
      expect(formatTime24Digits("1430")).toBe("14:30");
      // Hora maior que 23 vira 23
      expect(formatTime24Digits("25")).toBe("23:");
      expect(formatTime24Digits("2530")).toBe("23:30");
    });

    it("limita minutos a 59", () => {
      expect(formatTime24Digits("1470")).toBe("14:59");
    });

    it("trata digitação direta com dois-pontos", () => {
      expect(formatTime24Digits("8:30")).toBe("8:30");
      expect(formatTime24Digits("14:45")).toBe("14:45");
      expect(formatTime24Digits("28:70")).toBe("23:59");
    });

    it("remove caracteres não numéricos", () => {
      expect(formatTime24Digits("14:30 PM")).toBe("14:30");
      expect(formatTime24Digits("abc")).toBe("");
    });
  });

  describe("normalizeTime24OnBlur", () => {
    it("completa horas de 1 dígito com zero à esquerda", () => {
      expect(normalizeTime24OnBlur("8")).toBe("08:00");
      expect(normalizeTime24OnBlur("8:30")).toBe("08:30");
      expect(normalizeTime24OnBlur("9:05")).toBe("09:05");
    });

    it("completa horas de 2 dígitos com minutos zerados", () => {
      expect(normalizeTime24OnBlur("14")).toBe("14:00");
      expect(normalizeTime24OnBlur("22")).toBe("22:00");
    });

    it("preserva horários 24h já formatados", () => {
      expect(normalizeTime24OnBlur("08:30")).toBe("08:30");
      expect(normalizeTime24OnBlur("17:45")).toBe("17:45");
      expect(normalizeTime24OnBlur("23:59")).toBe("23:59");
      expect(normalizeTime24OnBlur("00:00")).toBe("00:00");
    });

    it("limita valores inválidos", () => {
      expect(normalizeTime24OnBlur("25:00")).toBe("23:00");
      expect(normalizeTime24OnBlur("12:75")).toBe("12:59");
    });
  });
});
