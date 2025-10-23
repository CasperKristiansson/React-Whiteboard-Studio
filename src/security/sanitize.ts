const TAG_REGEX = /<[^>]*>/g
const SCRIPT_REGEX = /script/gi

export const sanitizePlainText = (value: string): string =>
  value.replace(TAG_REGEX, '').replace(SCRIPT_REGEX, '')

