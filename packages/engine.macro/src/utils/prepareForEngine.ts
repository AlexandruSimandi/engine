import * as Babel from "@babel/core";
import { parseRef } from "./parseRef";
import { getConfig } from "./getConfig";
import { structOperationCompiler, paramsCompiler } from "../compilers";
import {
  CallExpression,
  ArrowFunctionExpression,
  objectExpression,
  objectProperty,
  identifier,
  importDeclaration,
  importSpecifier,
  stringLiteral,
  VariableDeclarator,
  callExpression,
  ImportDeclaration,
  isImportSpecifier,
} from "@babel/types";
import { validateRef } from "./validateRef";

export enum TransformType {
  PRODUCER = "PRODUCER",
  VIEW = "VIEW",
}
type PrepareForEngine = (
  babel: typeof Babel,
  state: any,
  ref: Babel.NodePath,
  type: TransformType
) => void;

export const prepareForEngine: PrepareForEngine = (babel, state, ref, type) => {
  const validation = validateRef(ref);
  if (validation.error) {
    throw new Error(validation.errorMessage);
  }

  const config = getConfig(state);

  const op = parseRef(babel, state, ref);
  const args = structOperationCompiler(op);
  const parent = ref.findParent((p) => p.isVariableDeclarator());
  const node = parent.node as VariableDeclarator;
  const fn = node.init as ArrowFunctionExpression;

  fn.params = paramsCompiler(op);
  const result = objectExpression([
    objectProperty(identifier("args"), args),
    objectProperty(identifier("fn"), fn),
  ]);

  if (type === TransformType.PRODUCER) {
    node.init = result;
  } else if (type === TransformType.VIEW) {
    const viewCall = callExpression(identifier("view"), [result]);
    node.init = viewCall;
    const viewImport = config.view.importFrom;
    const macroImport = ref
      .findParent((p) => p.isProgram())
      .get("body")
      .find((p) => {
        const result =
          p.isImportDeclaration() &&
          p.node.source.value.indexOf("@c11/engine.macro") !== -1;
        return result;
      });
    const engineImport = ref
      .findParent((p) => p.isProgram())
      .get("body")
      .find((p) => {
        const result =
          p.isImportDeclaration() &&
          p.node.source.value.indexOf(viewImport) !== -1;
        return result;
      });

    if (macroImport) {
      if (!engineImport) {
        macroImport.insertAfter(
          importDeclaration(
            [importSpecifier(identifier("view"), identifier("view"))],
            stringLiteral(viewImport)
          )
        );
      } else {
        const node = engineImport.node as ImportDeclaration;
        const viewNode = node.specifiers.find((node) => {
          return isImportSpecifier(node) && node.imported.name === "view";
        });
        if (!viewNode) {
          node.specifiers.push(
            importSpecifier(identifier("view"), identifier("view"))
          );
        }
      }
    } else {
      throw new Error("Could not find macro import");
    }
  }
};
