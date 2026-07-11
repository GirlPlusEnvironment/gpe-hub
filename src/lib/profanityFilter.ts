import {
    RegExpMatcher,
    englishDataset,
    englishRecommendedTransformers,
  } from "obscenity";
  
  const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
  });
  
  /**
   * Checks if the given text contains profane language
   * @param text - The text to check for profanity
   * @returns true if profanity is detected, false otherwise
   */
  export function hasProfanity(text: string): boolean {
    if (!text || typeof text !== "string") {
      return false;
    }
    return matcher.hasMatch(text);
  }
  
  /**
   * Validates content and throws an error if profanity is detected
   * @param text - The text to validate
   * @throws Error if profanity is detected
   */
  export function validateContent(text: string): void {
    if (hasProfanity(text)) {
      throw new Error(
        "Your content contains inappropriate language. Please revise and try again."
      );
    }
  }
  