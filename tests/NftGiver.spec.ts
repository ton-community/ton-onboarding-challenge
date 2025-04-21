// Hash: a27cfc5c24dd080461e003bf9be6adfc9cad0b4e9722a9aebc8bb5d96ac6413f
// HashBase64: onz8XCTdCARh4AO/m+at/JytC06XIqmuvIu12WrGQT8=
// Hex: b5ee9c7241021b010002c4000114ff00f4a413f4bcf2c80b0102016202120202cd030c0201200409020120050802f70831c02456f8007434c0c05c6c2456f83e900c3c004875c2c7e084135a5b996ea4cc3c01f80074c7f4cfe0841a4f4e54148c2ea38a0c0c7e117420842a32c02b5c20043232c1540173c5893e808532da84f2c7f2cfc073c5b260103ec0380c60841494d8db14882ea3a1db0874c7cc36cf383e1044f1c17cb864482006070088f001f8235301bcf29cf84712bcf29df8475210a1f849aa035210bef29ef800f849a9d57ff84baef8465210a9d47f22b991319730f84601a9b57fe2f866f849a1f867f002003ec0039830fa4030f861f002e0c0049ad401f863d430f865f002e030840ff2f000713b51343e90007e1874cfc07e18b5007e18f5007e1935007e1974ffc07e19b4c7c07e19f4dfc07e1a34c7c07e1a74c1c07e1ab4c1c07e1af4600201200a0b005b3e12fe12be127e123e11fe11be117e113e10fe10b23e1073c5b2cff3333332fff2c7f2dff2c7f2c1f2c1f27b5520002d007232cffe0a33c5b25c083232c044fd003d0032c032600201200d100201200e0f001b3e401d3232c084b281f2fff274200039167c00dc087c011de0063232c15633c59c3e80b2daf3333260103ec02001f5520f901f846b9f298d31f31d31ffa40d3ffd37fd3ff3004f823a17ab60130f848ba5214ba13b0f299f825f81501f815f823f847a120c2008e25f849a9d57f77aa7cb60979aa7cb608f84601a9b57ff866f846f84aaeb609f84baeb608f8669130e2f823f867f810ab7ff868f842f844c8c9c85004cf1613ccc9128110012f005f842a4f862f002020120131a0201201415002db8b5d31f001f843d0d431d430d071c8cb0701cf16ccc980201201617001db5dafe003f08ba1a61fa61ff48061002012018190019b1e8fc007e113c00dc007c01200021b1f6fc007e11be11fe123e127e12be12e0001dbc82df800fc21e87c2100ea187c20c3997053e

import { NftGiver, NftGiverConfig, OpCodes, Queries } from '../wrappers/NftGiver';
import { beginCell, Cell, contractAddress } from '@ton/ton';
import { unixNow } from '../lib/utils';
import { compile } from '@ton/blueprint';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { randomAddress } from '@ton/test-utils';

const ROYALTY_ADDRESS = randomAddress();

describe('NftGiver', () => {
    let nftGiverCode: Cell;

    beforeAll(async () => {
        nftGiverCode = await compile('NftGiver');
    });

    let blockchain: Blockchain;

    let sender: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;

    let defaultConfig: NftGiverConfig;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        sender = await blockchain.treasury('sender');
        owner = await blockchain.treasury('owner');

        defaultConfig = {
            ownerAddress: owner.address,
            nextItemIndex: 777n,
            collectionContent: 'collection_content',
            commonContent: 'common_content',
            nftItemCode: Cell.EMPTY,
            royaltyParams: {
                royaltyFactor: 100n,
                royaltyBase: 200n,
                royaltyAddress: ROYALTY_ADDRESS
            },
            powComplexity: 0n,
            lastSuccess: 0n,
            seed: 0n,
            targetDelta: 15n * 60n, // 15 minutes
            minComplexity: 240n,
            maxComplexity: 252n
        };
    });

    async function deployCollection(collection: SandboxContract<NftGiver>) {
        const { transactions } = await collection.sendDeploy(sender.getSender());
        expect(transactions).toHaveTransaction({
            from: sender.address,
            to: collection.address,
            success: true,
            deploy: true
        });
    }

    it('should mine new nft', async () => {
        const receiver = randomAddress();
        const now = unixNow();
        blockchain.now = now;

        const params = {
            expire: now + 30,
            mintTo: receiver,
            data1: 0n,
            seed: defaultConfig.seed
        };
        const hash = Queries.mine(params).hash();

        const config = {
            ...defaultConfig,
            powComplexity: BigInt('0x' + hash.toString('hex')) + 1n,
            lastSuccess: BigInt(now - 30)
        };

        const collection = blockchain.openContract(NftGiver.createFromConfig(config, nftGiverCode));

        const res = await collection.sendMineNft(sender.getSender(), params);

        // As a result of mint query, collection contract should send stateInit message to NFT item contract
        let nftItemData = beginCell()
            .storeUint(config.nextItemIndex, 64)
            .storeAddress(collection.address)
            .endCell();

        expect(res.transactions).toHaveTransaction({
            success: true,
            deploy: true,
            initCode: config.nftItemCode,
            initData: nftItemData
        });

        const miningData = await collection.getMiningData();

        expect(miningData.powComplexity >= (1n << config.minComplexity)).toBeTruthy();
        expect(miningData.powComplexity <= (1n << config.maxComplexity)).toBeTruthy();
    });


    it('should not mine new nft when POW is not solved', async () => {
        const receiver = randomAddress();
        const now = unixNow();
        blockchain.now = now;

        const params = {
            expire: now + 30,
            mintTo: receiver,
            data1: 0n,
            seed: defaultConfig.seed
        };
        const hash = Queries.mine(params).hash();

        const config = {
            ...defaultConfig,
            powComplexity: BigInt('0x' + hash.toString('hex')),
            lastSuccess: BigInt(now - 30)
        };

        const collection = blockchain.openContract(NftGiver.createFromConfig(config, nftGiverCode));

        const res = await collection.sendMineNft(sender.getSender(), params);
        expect(res.transactions).toHaveTransaction({
            from: sender.address,
            to: collection.address,
            success: false,
            exitCode: 24
        });
    });

    it('should rescale', async () => {
        const config = { ...defaultConfig };
        const now = unixNow();
        blockchain.now = now;

        config.lastSuccess = BigInt(now) - config.targetDelta * 16n;
        config.powComplexity = 1n << config.minComplexity;

        const collection = blockchain.openContract(NftGiver.createFromConfig(config, nftGiverCode));

        const res = await collection.sendRescaleComplexity(sender.getSender(), { expire: now - 1 });

        expect(res.transactions).toHaveTransaction({
            from: sender.address,
            to: collection.address,
            success: true
        });

        const miningData = await collection.getMiningData();

        expect(miningData.powComplexity > config.powComplexity).toBeTruthy();
    });

    it('should not rescale if not enough time passed', async () => {
        const config = { ...defaultConfig };
        const now = unixNow();
        blockchain.now = now;

        config.lastSuccess = BigInt(now) - config.targetDelta * 16n + 1n; // this should make rescale fail

        const collection = blockchain.openContract(NftGiver.createFromConfig(config, nftGiverCode));

        const res = await collection.sendRescaleComplexity(sender.getSender(), { expire: now - 1 });

        expect(res.transactions).toHaveTransaction({
            from: sender.address,
            to: collection.address,
            success: false,
            exitCode: 30
        });
    });

    it('should return collection data', async () => {
        const collection = blockchain.openContract(NftGiver.createFromConfig(defaultConfig, nftGiverCode));
        await deployCollection(collection);

        let res = await collection.getCollectionData();

        expect(res.nextItemId).toEqual(defaultConfig.nextItemIndex);
        expect(res.collectionContent).toEqual(defaultConfig.collectionContent);
        expect(res.ownerAddress).toEqualAddress(defaultConfig.ownerAddress);
    });


    it('should return nft content', async () => {
        const collection = blockchain.openContract(NftGiver.createFromConfig(defaultConfig, nftGiverCode));
        await deployCollection(collection);

        let nftContent = beginCell().storeBuffer(Buffer.from('1')).endCell();
        let res = await collection.getNftContent(0, nftContent);
        expect(res).toEqual(defaultConfig.commonContent + '1');
    });

    it('should return nft address by index', async () => {
        const collection = blockchain.openContract(NftGiver.createFromConfig(defaultConfig, nftGiverCode));
        await deployCollection(collection);

        let index = 77;
        let nftAddress = await collection.getNftAddressByIndex(index);

        // Basic nft item data
        let nftItemData = beginCell()
            .storeUint(index, 64)
            .storeAddress(collection.address)
            .endCell();

        let expectedAddress = contractAddress(0, {
            code: defaultConfig.nftItemCode,
            data: nftItemData
        });

        expect(nftAddress).toEqualAddress(expectedAddress);
    });

    it('should return royalty params', async () => {
        const collection = blockchain.openContract(NftGiver.createFromConfig(defaultConfig, nftGiverCode));
        await deployCollection(collection);

        let res = await collection.getRoyaltyParams();

        expect(res.royaltyBase).toEqual(defaultConfig.royaltyParams.royaltyBase);
        expect(res.royaltyFactor).toEqual(defaultConfig.royaltyParams.royaltyFactor);
        expect(res.royaltyAddress).toEqualAddress(defaultConfig.royaltyParams.royaltyAddress);
    });


    it('should not change owner from not owner', async () => {
        const collection = blockchain.openContract(NftGiver.createFromConfig(defaultConfig, nftGiverCode));

        let newOwner = randomAddress();

        let res = await collection.sendChangeOwner(sender.getSender(), { newOwner });
        expect(res.transactions).toHaveTransaction({
            from: sender.address,
            to: collection.address,
            success: false
        });

        let { ownerAddress } = await collection.getCollectionData();
        expect(ownerAddress).toEqualAddress(owner.address);
    });

    it('should change owner from owner', async () => {
        const collection = blockchain.openContract(NftGiver.createFromConfig(defaultConfig, nftGiverCode));

        let newOwner = randomAddress();

        const res = await collection.sendChangeOwner(owner.getSender(), { newOwner });
        expect(res.transactions).toHaveTransaction({
            from: owner.address,
            to: collection.address,
            success: true
        });

        let { ownerAddress } = await collection.getCollectionData();
        expect(ownerAddress).toEqualAddress(newOwner);
    });

    it('should send royalty params', async () => {
        const collection = blockchain.openContract(NftGiver.createFromConfig(defaultConfig, nftGiverCode));

        let res = await collection.sendGetRoyaltyParams(sender.getSender());
        expect(res.transactions).toHaveTransaction({
            from: sender.address,
            to: collection.address,
            success: true
        });

        expect(res.transactions).toHaveTransaction({
            from: collection.address,
            to: sender.address,
            success: true,
            body: beginCell()
                .storeUint(OpCodes.GetRoyaltyParamsResponse, 32)
                .storeUint(0, 64) // queryId
                .storeUint(defaultConfig.royaltyParams.royaltyFactor, 16)
                .storeUint(defaultConfig.royaltyParams.royaltyBase, 16)
                .storeAddress(ROYALTY_ADDRESS)
                .endCell()
        });
    });

    it('should not edit content from not owner', async () => {
        const collection = blockchain.openContract(NftGiver.createFromConfig(defaultConfig, nftGiverCode));

        let royaltyAddress = randomAddress();
        let res = await collection.sendEditContent(sender.getSender(), {
            collectionContent: 'new_content',
            commonContent: 'new_common_content',
            royaltyParams: {
                royaltyFactor: 150n,
                royaltyBase: 220n,
                royaltyAddress
            }
        });

        expect(res.transactions).toHaveTransaction({
            from: sender.address,
            to: collection.address,
            success: false
        });
    });

    it('should edit content', async () => {
        const collection = blockchain.openContract(NftGiver.createFromConfig(defaultConfig, nftGiverCode));

        let royaltyAddress = randomAddress();
        const res = await collection.sendEditContent(owner.getSender(), {
            collectionContent: 'new_content',
            commonContent: 'new_common_content',
            royaltyParams: {
                royaltyFactor: 150n,
                royaltyBase: 220n,
                royaltyAddress
            }
        });

        expect(res.transactions).toHaveTransaction({
            from: owner.address,
            to: collection.address,
            success: true
        });

        let { collectionContent } = await collection.getCollectionData();
        expect(collectionContent).toEqual('new_content');

        let royalty = await collection.getRoyaltyParams();
        expect(royalty.royaltyBase).toEqual(220n);
        expect(royalty.royaltyFactor).toEqual(150n);
        expect(royalty.royaltyAddress).toEqualAddress(royaltyAddress);
    });

});
