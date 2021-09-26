import {
    Pool,
    Position,
    NonfungiblePositionManager,
    nearestUsableTick,
} from '@uniswap/v3-sdk/'

import { ethers } from "ethers";
import { Percent, Token/*, CurrencyAmount*/ } from "@uniswap/sdk-core";
import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import fp from "evm-fp";

const provider = new ethers.providers.JsonRpcProvider(
    "https://mainnet.infura.io/v3/5b0ce7307ba24e02ad36878aad730b9a"
);
const poolAddress = "0x6c6bc977e13df9b0de53b251522280bb72383700";
const poolContract = new ethers.Contract(
    poolAddress,
    IUniswapV3PoolABI,
    provider
);

interface Immutables {
    factory: string;
    token0: string;
    token1: string;
    fee: number;
    tickSpacing: number;
    maxLiquidityPerTick: ethers.BigNumber;
}
  
interface State {
    liquidity: ethers.BigNumber;
    sqrtPriceX96: ethers.BigNumber;
    tick: number;
    observationIndex: number;
    observationCardinality: number;
    observationCardinalityNext: number;
    feeProtocol: number;
    unlocked: boolean;
}

async function getPoolImmutables() {
    const immutables: Immutables = {
        factory: await poolContract.factory(),
        token0: await poolContract.token0(),
        token1: await poolContract.token1(),
        fee: await poolContract.fee(),
        tickSpacing: await poolContract.tickSpacing(),
        maxLiquidityPerTick: await poolContract.maxLiquidityPerTick(),
    };
    return immutables;
}

async function getPoolState() {
    const slot = await poolContract.slot0();  
    const PoolState: State = {
      liquidity: await poolContract.liquidity(),
      sqrtPriceX96: slot[0],
      tick: slot[1],
      observationIndex: slot[2],
      observationCardinality: slot[3],
      observationCardinalityNext: slot[4],
      feeProtocol: slot[5],
      unlocked: slot[6],
    };
    return PoolState;
}

async function main() {
    const immutables = await getPoolImmutables();
    const state = await getPoolState();
    const DAI = new Token(1, immutables.token0, 18, "DAI", "Stablecoin");
    const USDC = new Token(1, immutables.token1, 18, "USDC", "USD Coin");
    const block = await provider.getBlock(provider.getBlockNumber());
    const deadline = block.timestamp + 200;

    console.log(state);

    const DAI_USDC_POOL = new Pool(
        DAI,
        USDC,
        immutables.fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick
    );

    const frac: ethers.BigNumber = fp("0.0002");
    // create a position with the pool
    // the position is in-range, specified by the lower and upper tick
    // in this example, we will set the liquidity parameter to a small percentage of the current liquidity
    const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: state.liquidity.mul(frac).toString(),
        tickLower: nearestUsableTick(state.tick, immutables.tickSpacing) - immutables.tickSpacing  * 2,
        tickUpper: nearestUsableTick(state.tick, immutables.tickSpacing) + immutables.tickSpacing * 2
    })

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, {
        slippageTolerance: new Percent(50, 10_000),
        recipient: /*sender*/"lulu",
        deadline: deadline
    });
    
    console.log(DAI_USDC_POOL);
    console.log(position);
    // console.log(state);
}

main();
  
console.log("minting")