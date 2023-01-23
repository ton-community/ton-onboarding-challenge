# TON Onboarding Challenge Boilerplate

Here you can become a true TVM Developer on the most advanced asynchronous blockchain in the world — The Open Network (TON). 

You can prove your talent using the most ancient and essential way in blockchains, starting from grandpa Bitcoin! As the first miners in TON, you will go through the Proof-of-Work smart contract and finally mine a secret reward for your TON wallet.

- [NFT Collection on GetGems with True TVM Developers](https://getgems.io/collection/EQDk8N7xM5D669LC2YACrseBJtDyFqwtSPCNhRWXU7kjEptX)

## Step-by-step (simple)

### Video Tutorial

[![Watch the video](https://img.youtube.com/vi/wEEQLwQy30Q/0.jpg)](https://youtu.be/wEEQLwQy30Q)

### Text tutorial

* [TON Onboarding Challenge](https://github.com/ton-society/ton-footsteps/issues/128)



## Mining process (advanced)

This is a NFT collection that differs from standard NFT collections in the following aspects:

- normal NFT deployment is disabled and one can mint NFTs only by mining (similar to how PoW givers worked)
- extra get-method is added for mining info

In order to mine NFT you should send special **internal** message to collection contract with proof of work.

You can get current `pow_complexity` by calling special get-function to get mining status called `get_mining_data`

It returns a [tensor](https://ton.org/docs/develop/func/types#tensor-types) with the following data: 

```
( 
	int pow_complexity,
	int last_success,
	int seed,
	int target_delta,
	int min_cpl,
	int max_cpl
)
```

Note that `seed` is set to a random value after every successful NFT mint.
`pow_complexity` is also a dynamic value and could be changed from time to time.

Layout of proof of work Cell:

| Field      | Type | Description     |
| :---        |    :----:   |          ---: |
| op      | uint32       | Always 0x4d696e65    |
| expire   | uint32        | Unixtime of message expiration (should be some unixtime in future, but not greater than ~17 minutes in future.)     |
| whom   | std_addr        | Address of the miner (NFT owner would be set to this address)      |
| rdata1   | uint256        | Some random data      |
| seed | uint128 | Current seed |
| rdata2 | uint256 | Should equal to rdata1 |

Proof of work is considered to be valid only if: 

- rdata1 equals to rdata2
- (expire - now()) < 1024
- seed is equal to current seed stored in contract
- hash of the proof of work message Cell is less than current pow_complexity (hash is compared as a big endian number)

Basically you need to find such value for `rdata1` so that hash of the Cell is less than current `pow_complexity`

After this an `internal` message with found Cell should be sent to collection with ~0.05 TON in order to mint NFT.
