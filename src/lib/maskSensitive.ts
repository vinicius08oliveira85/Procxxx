/**
 * Mascaramento de dados pessoais antes de enviar amostras para um serviço externo
 * (assistente Gemini). Mantém o formato/estrutura visível para o modelo, mas
 * esconde CPF/CNPJ/telefone e o nome local de e-mails.
 */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Sequências de dígitos, possivelmente com separadores (123.456.789-00 / (11) 91234-5678). */
const DIGIT_RUN_RE = /\d[\d.\-/\s]*\d/g;

/** CPF (11), CNPJ (14) e telefones (10–11) — só estes comprimentos são mascarados. */
const MASK_MIN_DIGITS = 9;
const MASK_MAX_DIGITS = 14;

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

function maskDigitRun(run: string): string {
  const digits = run.replace(/\D/g, '');
  if (digits.length < MASK_MIN_DIGITS || digits.length > MASK_MAX_DIGITS) return run;

  let seen = 0;
  const keepLimit = 2;
  return run.replace(/\d/g, (d) => {
    seen += 1;
    const isEdge = seen <= keepLimit || seen > digits.length - keepLimit;
    return isEdge ? d : '*';
  });
}

/** Devolve o valor com e-mails e identificadores longos mascarados. */
export function maskSensitiveValue(value: string): string {
  if (!value) return value;
  return value.replace(EMAIL_RE, maskEmail).replace(DIGIT_RUN_RE, maskDigitRun);
}
