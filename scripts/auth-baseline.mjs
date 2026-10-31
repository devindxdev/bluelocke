import crypto from 'node:crypto'
import ts from 'typescript'

// Compare executable method bodies to the supplied v1.24.4 release. The only
// permitted additions in these methods are observational log-secret registration.
export function authFingerprints(source) {
  const parsed = ts.createSourceFile('baseline.ts', source, ts.ScriptTarget.Latest, true)
  const transformed = ts.transform(parsed, [
    (context) => {
      const stripLogRegistration = (node) => {
        if (
          ts.isIfStatement(node) &&
          !node.elseStatement &&
          ts.isExpressionStatement(node.thenStatement) &&
          ts.isCallExpression(node.thenStatement.expression) &&
          node.thenStatement.expression.expression.getText(parsed) === 'registerLogSecrets'
        )
          return undefined
        if (
          ts.isExpressionStatement(node) &&
          ts.isCallExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'registerLogSecrets'
        )
          return undefined
        return ts.visitEachChild(node, stripLogRegistration, context)
      }
      return (root) => ts.visitNode(root, stripLogRegistration)
    },
  ])
  const ast = transformed.transformed[0]
  const printer = ts.createPrinter({ removeComments: true })
  const result = {}
  const authName =
    /^(constructor|init|superInit|refreshLogin|login|refreshTokens|newRefreshTokens|mfa|regenerateDeviceId|hasRecentMfaRequest|markMfaRequestStarted|clearMfaRequestStarted|requestResponseValid|getSessionCookie|getMfaRequestDetails|getDeviceId|generateDeviceId|getAdditionalHeaders|getStamp|getTimeZone|getTimeZoneFull|tokenValid|getCacheKey|deleteCache|saveCache|cacheExists|loadCache|nextRequestCookies|_get_cookies|newLogin|newLoginKia|newLoginHyundai|HyundaiLogin|KiaLogin|KiaDeviceRegistration|initKiaSession|tokenExchange|loginWithWebview|caseInsensitiveParamExtraction|genRanHex|configExists|deleteConfig|setConfig|getConfig)$/
  const visit = (node) => {
    const name = ts.isConstructorDeclaration(node) ? 'constructor' : node.name?.getText(ast)
    if (
      (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isFunctionDeclaration(node)) &&
      authName.test(name)
    ) {
      const text = printer.printNode(ts.EmitHint.Unspecified, node, ast)
      result[name] = crypto.createHash('sha256').update(text).digest('hex')
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return result
}
