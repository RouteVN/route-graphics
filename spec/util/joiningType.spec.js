import { describe, expect, it } from "vitest";
import { getJoiningType, joinsAcross } from "../../src/util/joiningType.js";

describe("getJoiningType", () => {
  it.each([
    ["ب", "D"],
    ["ر", "R"],
    ["ا", "R"],
    ["ء", "U"],
    ["ـ", "C"],
    ["‍", "C"],
    ["‌", "U"],
    ["َ", "T"],
    ["ܐ", "R"],
    ["𞤀", "D"],
    ["א", "U"],
    ["a", "U"],
    [" ", "U"],
  ])("classifies %s as %s", (character, type) => {
    expect(getJoiningType(character.codePointAt(0))).toBe(type);
  });
});

describe("joinsAcross", () => {
  it.each([
    ["مرح", "با", true],
    ["كت", "اب", true],
    ["مر", "حبا", false],
    ["ا", "ب", false],
    ["ب", " ب", false],
    ["ب ", "ب", false],
    ["ب", "a", false],
    ["", "ب", false],
    ["ب", "", false],
    // Marks are skipped on both sides.
    ["بَ", "ب", true],
    ["ب", "َب", true],
    ["َ", "ب", false],
    // Adlam is cursive and lives outside the basic plane.
    ["𞤀", "𞤁", true],
    ["𞤀", "a", false],
  ])("%s | %s -> %s", (before, after, expected) => {
    expect(joinsAcross(before, after)).toBe(expected);
  });
});
