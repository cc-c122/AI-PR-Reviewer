const generatedFilePatterns = [
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)coverage\//,
  /\.min\.(js|css)$/,
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /yarn\.lock$/
];

export function isLikelyGeneratedFile(path: string): boolean {
  return generatedFilePatterns.some((pattern) => pattern.test(path));
}
