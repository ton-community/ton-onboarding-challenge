import {Address, beginCell, Cell, contractAddress, StateInit} from "ton";
import BN from "bn.js";
import { getNftGiverCodeCell } from "./NftGiver.code";
import { encodeOffChainContent } from "../lib/utils";

export type RoyaltyParams = {
    royaltyFactor: number
    royaltyBase: number
    royaltyAddress: Address
}

export type MiningData = {
    powComplexity: BN
    lastSuccess: number
    seed: BN
    targetDelta: number
    minComplexity: number
    maxComplexity: number
}

export type NftGiverData = {
    ownerAddress: Address
    nextItemIndex: number | BN
    collectionContent: string
    commonContent: string
    nftItemCode: Cell
    royaltyParams: RoyaltyParams
} & MiningData

// default#_ royalty_factor:uint16 royalty_base:uint16 royalty_address:MsgAddress = RoyaltyParams;
//
// storage#_
//  owner_address:MsgAddress next_item_index:uint64
//  ^[collection_content:^Cell common_content:^Cell]
//  nft_item_code:^Cell
//  royalty_params:^RoyaltyParams
//  = Storage;

export function buildNftGiverDataCell(data: NftGiverData) {
    let dataCell = new Cell()

    dataCell.bits.writeAddress(data.ownerAddress)
    dataCell.bits.writeUint(data.nextItemIndex, 64)

    let contentCell = new Cell()

    let collectionContent = encodeOffChainContent(data.collectionContent)

    let commonContent = new Cell()
    commonContent.bits.writeBuffer(Buffer.from(data.commonContent))

    contentCell.refs.push(collectionContent)
    contentCell.refs.push(commonContent)
    dataCell.refs.push(contentCell)

    dataCell.refs.push(data.nftItemCode)

    let royaltyCell = new Cell()
    royaltyCell.bits.writeUint(data.royaltyParams.royaltyFactor, 16)
    royaltyCell.bits.writeUint(data.royaltyParams.royaltyBase, 16)
    royaltyCell.bits.writeAddress(data.royaltyParams.royaltyAddress)
    dataCell.refs.push(royaltyCell)

    dataCell.bits.writeUint(data.powComplexity, 256)
    dataCell.bits.writeUint(data.lastSuccess, 32)
    dataCell.bits.writeUint(data.seed, 128)
    dataCell.bits.writeUint(data.targetDelta, 32)
    dataCell.bits.writeUint(data.minComplexity, 8)
    dataCell.bits.writeUint(data.maxComplexity, 8)

    return dataCell
}

export async function buildNftGiverStateInit(conf: NftGiverData) {
    const dataCell = buildNftGiverDataCell(conf)
    const codeCell = await getNftGiverCodeCell()
    let stateInit = new StateInit({
        code: codeCell,
        data: dataCell
    })

    let stateInitCell = new Cell()
    stateInit.writeTo(stateInitCell)

    let address = contractAddress({workchain: 0, initialCode: codeCell, initialData: dataCell})

    return {
        stateInit: stateInitCell,
        stateInitMessage: stateInit,
        address
    }
}

export const OperationCodes = {
    ChangeOwner: 3,
    EditContent: 4,
    GetRoyaltyParams: 0x693d3950,
    GetRoyaltyParamsResponse: 0xa8cb00ad,
    Mine: 0x4d696e65,
    RescaleComplexity: 0x5253636c,
}

export type MineMessageParams = {
    expire: number;
    mintTo: Address;
    data1: BN;
    seed: BN;
    data2?: BN;
}

export const Queries = {
    changeOwner: (params: { queryId?: number, newOwner: Address }) => {
        let msgBody = new Cell()
        msgBody.bits.writeUint(OperationCodes.ChangeOwner, 32)
        msgBody.bits.writeUint(params.queryId || 0, 64)
        msgBody.bits.writeAddress(params.newOwner)
        return msgBody
    },
    getRoyaltyParams: (params: { queryId?: number }) => {
        let msgBody = new Cell()
        msgBody.bits.writeUint(OperationCodes.GetRoyaltyParams, 32)
        msgBody.bits.writeUint(params.queryId || 0, 64)
        return msgBody
    },
    editContent: (params: { queryId?: number, collectionContent: string, commonContent: string,  royaltyParams: RoyaltyParams }) => {
        let msgBody = new Cell()
        msgBody.bits.writeUint(OperationCodes.EditContent, 32)
        msgBody.bits.writeUint(params.queryId || 0, 64)

        let royaltyCell = new Cell()
        royaltyCell.bits.writeUint(params.royaltyParams.royaltyFactor, 16)
        royaltyCell.bits.writeUint(params.royaltyParams.royaltyBase, 16)
        royaltyCell.bits.writeAddress(params.royaltyParams.royaltyAddress)

        let contentCell = new Cell()

        let collectionContent = encodeOffChainContent(params.collectionContent)

        let commonContent = new Cell()
        commonContent.bits.writeBuffer(Buffer.from(params.commonContent))

        contentCell.refs.push(collectionContent)
        contentCell.refs.push(commonContent)

        msgBody.refs.push(contentCell)
        msgBody.refs.push(royaltyCell)

        return msgBody
    },
    mine: (params: MineMessageParams) => beginCell()
        .storeUint(OperationCodes.Mine, 32)
        .storeUint(params.expire, 32)
        .storeAddress(params.mintTo)
        .storeUint(params.data1, 256)
        .storeUint(params.seed, 128)
        .storeUint(params.data2 || params.data1, 256)
        .endCell(),
    rescaleComplexity: (params: { queryId?: number, expire: number }) => beginCell()
        .storeUint(OperationCodes.RescaleComplexity, 32)
        .storeUint(params.queryId || 0, 64)
        .storeUint(params.expire, 32)
        .endCell(),
}