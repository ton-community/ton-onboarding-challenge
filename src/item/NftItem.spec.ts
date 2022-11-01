import {Cell, CellMessage, CommonMessageInfo, ExternalMessage, InternalMessage, toNano} from "ton";
import {NftItemData, Queries} from "./NftItem.data";
import {NftItemLocal} from "./NftItemLocal";
import {randomAddress} from "../lib/utils";

const OWNER_ADDRESS = randomAddress()
const COLLECTION_ADDRESS = randomAddress()

const defaultConfig: NftItemData = {
    index: 777,
    collectionAddress: COLLECTION_ADDRESS,
    ownerAddress: OWNER_ADDRESS,
    content: 'test',
}

describe('nft item smc', () => {
    it('should ignore external messages', async () => {
        let nft = await NftItemLocal.createFromConfig(defaultConfig)

        let res = await nft.contract.sendExternalMessage(new ExternalMessage({
            to: nft.address,
            from: OWNER_ADDRESS,
            body: new CommonMessageInfo({
                body: new CellMessage(new Cell())
            })
        }))

        expect(res.exit_code).not.toEqual(0)
    })

    it('should return item data', async () => {
        let nft = await NftItemLocal.createFromConfig(defaultConfig)
        let res = await nft.getNftData()
        if (!res.isInitialized) {
            throw new Error()
        }
        expect(res.isInitialized).toBe(true)
        expect(res.index).toEqual(defaultConfig.index)
        expect(res.collectionAddress!.toFriendly()).toEqual(defaultConfig.collectionAddress!.toFriendly())
        expect(res.ownerAddress.toFriendly()).toEqual(defaultConfig.ownerAddress!.toFriendly())
        expect(res.content).toEqual(defaultConfig.content)
    })

    it('should return editor', async () => {
        let nft = await NftItemLocal.createFromConfig(defaultConfig)
        let res = await nft.getEditor()
        expect(res).toEqual(null)
    })

    it('should transfer', async () => {
        let nft = await NftItemLocal.createFromConfig(defaultConfig)
        let newOwner = randomAddress()
        let res = await nft.contract.sendInternalMessage(new InternalMessage({
            to: nft.address,
            from: defaultConfig.ownerAddress,
            value: toNano(1),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.transfer({
                    newOwner,
                    forwardAmount: toNano('0.01'),
                    responseTo: randomAddress()
                }))
            })
        }))

        expect(res.exit_code).toEqual(0)

        let data = await nft.getNftData()
        if (!data.isInitialized) {
            throw new Error()
        }

        expect(data.ownerAddress.toFriendly()).toEqual(newOwner.toFriendly())
    })
})
