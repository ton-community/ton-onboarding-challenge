import { compileFunc, CompileResult } from "@ton-community/func-js";
import { readFileSync } from "fs";
import { Cell } from "ton";

const files = ['stdlib.fc', 'params.fc', 'op-codes.fc', 'item.fc'];

let result: CompileResult | null = null;

export const getNftItemCompileResult = async () => {
    if (result !== null) return result;
    const sources: { [key: string]: string } = {};
    for (const f of files) {
        sources[f] = readFileSync(__dirname + '/../func/' + f).toString();
    }
    result = await compileFunc({
        sources,
        entryPoints: ['item.fc'],
    });
    return result;
};

let code: Cell | null = null;

export const getNftItemCodeCell = async () => {
    if (code !== null) return code;

    const compileResult = await getNftItemCompileResult();
    if (compileResult.status === 'error') {
        throw new Error('could not get compile result: ' + compileResult.message);
    }

    code = Cell.fromBoc(Buffer.from(compileResult.codeBoc, 'base64'))[0];

    return code;
};