import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as commonLib from "@zxcvbn-ts/language-common";
import * as enLib from "@zxcvbn-ts/language-en";

const options = {
  translations: enLib.translations,
  graphs: commonLib.adjacencyGraphs,
  dictionary: {
    ...commonLib.dictionary,
    ...enLib.dictionary,
  },
};

zxcvbnOptions.setOptions(options);

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  minScore: 3,
  requireSpecialChar: true,
};

export interface PasswordValidationResult {
  isValid: boolean;
  score: number;
  requirements: {
    length: boolean;
    specialChar: boolean;
    strength: boolean;
  };
  error?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  const lengthValid = password.length >= PASSWORD_REQUIREMENTS.minLength;
  const specialCharValid = /[\!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/.test(password);
  
  const strengthResult = zxcvbn(password);
  const strengthValid = strengthResult.score >= PASSWORD_REQUIREMENTS.minScore;

  const isValid = lengthValid && specialCharValid && strengthValid;

  let error: string | undefined;
  if (!lengthValid) {
    error = `La contraseña debe tener al menos ${PASSWORD_REQUIREMENTS.minLength} caracteres.`;
  } else if (!specialCharValid) {
    error = "La contraseña debe incluir al menos un carácter especial.";
  } else if (!strengthValid) {
    error = "La contraseña es demasiado débil. Intenta usar una combinación más compleja.";
  }

  return {
    isValid,
    score: strengthResult.score,
    requirements: {
      length: lengthValid,
      specialChar: specialCharValid,
      strength: strengthValid,
    },
    error,
  };
}

