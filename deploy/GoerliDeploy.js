module.exports = async (hre) => {
    const { getNamedAccounts, ethers } = hre
    const { deploy, execute, save } = deployments
    const { deployer } = await getNamedAccounts()
    const accounts = await ethers.getSigners()

    const DEPLOY_POOL_GAS_LIMIT = 10000000

    const POOL_DEFAULT_MINTING_FEE = ethers.utils.parseEther("0")
    const POOL_DEFAULT_MANAGEMENT_FEE = ethers.utils.parseEther("0")
    const POOL_DEFAULT_BURNING_FEE = ethers.utils.parseEther("0")
    const POOL_DEFAULT_CHANGE_INTERVAL = "0"

    const HALF_LEVERAGE = 42

    const SMA_DEFAULT_PERIODS = 8
    const SMA_DEFAULT_UPDATE_INTERVAL = 60 * 60

    const ethUsdSpotPricePool = {
        code: "ETH/USD+USDC-12h",
        stylizedCode: "EthUsdSpotPrice",
        frontRunningInterval: 300,
        updateInterval: 43200,
    }
    const ethUsd8hPool = {
        code: "ETH/USD+USDC",
        stylizedCode: "EthUsd8h",
        frontRunningInterval: 28800,
        updateInterval: 3600,
    }

    const pools = [
        ethUsdSpotPricePool,
        ethUsd8hPool,
    ]

    // deploy Uniswap V2
    const uniswapV2Factory = {
        abi: require("@uniswap/v2-core/build/UniswapV2Factory.json").abi,
        address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    }

    await save("UniswapV2Factory", uniswapV2Factory)

    const uniswapV2Router02 = {
        abi: require("@uniswap/v2-periphery/build/UniswapV2Router02.json").abi,
        address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    }

    await save("UniswapV2Router02", uniswapV2Router02)

    // deploy test tokens
    const token0 = await deploy("TestTokenETH", {
        args: ["Pong ETH", "PETH"],
        from: deployer,
        log: true,
        contract: "TestToken",
    })

    const token1 = await deploy("TestTokenUSD", {
        args: ["Pong USD", "PUSD"],
        from: deployer,
        log: true,
        contract: "TestToken",
    })

    // mint some bills
    await execute(
        "TestTokenETH",
        {
            from: deployer,
            log: true,
        },
        "mint",
        accounts[0].address,
        ethers.utils.parseEther("100001") // 0.1 mil supply
    )

    await execute(
        "TestTokenUSD",
        {
            from: deployer,
            log: true,
        },
        "mint",
        accounts[0].address,
        ethers.utils.parseEther("100001000") // 100 mil supply
    )

    // deploy LP token
    let receipt = await execute(
        "UniswapV2Factory",
        {
            from: deployer,
            log: true,
        },
        "createPair",
        token0.address,
        token1.address
    )

    const token = {
        address: receipt.events.find(e => e.event == "PairCreated").args[2]
    }

    await execute(
        "TestTokenETH",
        {
            from: deployer,
            log: true,
            gasLimit: DEPLOY_POOL_GAS_LIMIT,
        },
        "approve",
        uniswapV2Router02.address,
        ethers.utils.parseEther("1")
    )

    await execute(
        "TestTokenUSD",
        {
            from: deployer,
            log: true,
            gasLimit: DEPLOY_POOL_GAS_LIMIT,
        },
        "approve",
        uniswapV2Router02.address,
        ethers.utils.parseEther("1000")
    )

    await execute(
        "UniswapV2Router02",
        {
            from: deployer,
            log: true,
            gasLimit: DEPLOY_POOL_GAS_LIMIT,
        },
        "addLiquidity",
        token0.address,
        token1.address,
        ethers.utils.parseEther("1"),
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1"),
        ethers.utils.parseEther("1000"),
        accounts[0].address,
        2147483647
    )

    // deploy PoolSwapLibrary
    const library = await deploy("PoolSwapLibrary", {
        from: deployer,
        log: true,
    })

    // deploy CalldataLogic
    const calldataLogic = await deploy("CalldataLogic", {
        from: deployer,
        log: true,
    })

    // deploy L2Encoder
    const l2Encoder = await deploy("L2Encoder", {
        from: deployer,
        log: true,
    })

    // deploy PoolFactory
    const factory = await deploy("PoolFactory", {
        from: deployer,
        log: true,
        libraries: { PoolSwapLibrary: library.address },
        // (fee receiver)
        args: [deployer, deployer],
    })

    // deploy InvariantCheck
    const invariantCheck = await deploy("InvariantCheck", {
        from: deployer,
        log: true,
        args: [factory.address],
    })

    // deploy Autoclaim
    const autoClaim = await deploy("AutoClaim", {
        from: deployer,
        log: true,
        args: [factory.address],
    })

    // deploy PoolKeeper
    const poolKeeper = await deploy("PoolKeeper", {
        from: deployer,
        log: true,
        libraries: { PoolSwapLibrary: library.address },
        args: [factory.address],
    })

    // deploy keeper rewards
    const keeperRewards = await deploy("KeeperRewards", {
        from: deployer,
        log: true,
        libraries: { PoolSwapLibrary: library.address },
        args: [poolKeeper.address],
    })

    // set keeper rewards
    await execute(
        "PoolKeeper",
        {
            from: deployer,
            log: true,
        },
        "setKeeperRewards",
        keeperRewards.address
    )

    // Set PoolKeeper
    await execute(
        "PoolFactory",
        {
            from: deployer,
            log: true,
        },
        "setPoolKeeper",
        poolKeeper.address
    )

    // Set Autoclaim
    await execute(
        "PoolFactory",
        {
            from: deployer,
            log: true,
        },
        "setAutoClaim",
        autoClaim.address
    )

    await execute(
        "PoolFactory",
        {
            from: deployer,
            log: true,
        },
        "setFee",
        POOL_DEFAULT_MANAGEMENT_FEE
    )

    await execute(
        "PoolFactory",
        {
            from: deployer,
            log: true,
        },
        "setInvariantCheck",
        invariantCheck.address
    )

    // base wrappers
    var oracleWrappers = []
    for (const pool of pools) {
        const oracleWrapper = await deploy(pool.stylizedCode + "OracleWrapper", {
            from: deployer,
            log: true,
            contract: "UniswapV2OracleWrapper",
            args: [token.address, deployer],
            gasLimit: DEPLOY_POOL_GAS_LIMIT,
        })
        oracleWrappers.push(oracleWrapper)
    }

    console.log(`Deployed TestToken: ${token.address}`)
    console.log(`Deployed PoolFactory: ${factory.address}`)
    console.log(`Deployed PoolSwapLibrary: ${library.address}`)
    console.log(`Deployed CalldataLogic: ${calldataLogic.address}`)
    console.log(`Deployed L2Encoder: ${l2Encoder.address}`)
    console.log(`Deployed PoolKeeper: ${poolKeeper.address}`)

    // deploy oracles
    var smaOracleWrappers = []
    for (const [i, pool] of pools.entries()) {
        if (pool.frontRunningInterval < pool.updateInterval) {
            smaOracleWrappers.push(oracleWrappers[i])
            continue
        }
        const smaOracleWrapper = await deploy(pool.stylizedCode + "SMAOracle", {
            from: deployer,
            log: true,
            contract: "SMAOracle",
            args: [
                oracleWrappers[i].address, // oracle address
                SMA_DEFAULT_PERIODS, // number of periods
                SMA_DEFAULT_UPDATE_INTERVAL, // update interval
                deployer, // deployer address
                deployer,
                deployer,
            ],
        })
        smaOracleWrappers.push(smaOracleWrapper)
    }

    // poll so there is an initial price
    for (const pool of pools) {
        if (pool.frontRunningInterval < pool.updateInterval) {
            continue
        }
        await execute(
            pool.stylizedCode + "SMAOracle",
            {
                from: deployer,
                log: true,
            },
            "poll",
        )
        await execute(
            pool.stylizedCode + "SMAOracle",
            {
                from: deployer,
                log: true,
            },
            "setPoolKeeper",
            poolKeeper.address
        )
    }

    // deploy pools
    for (const [i, pool] of pools.entries()) {
        const deploymentData = {
            poolName: pool.code,
            frontRunningInterval: pool.frontRunningInterval,
            updateInterval: pool.updateInterval,
            leverageAmount: HALF_LEVERAGE,
            settlementToken: token.address,
            oracleWrapper: smaOracleWrappers[i].address,
            settlementEthOracle: oracleWrappers[i].address,
            feeController: deployer,
            mintingFee: POOL_DEFAULT_MINTING_FEE,
            burningFee: POOL_DEFAULT_BURNING_FEE,
            changeInterval: POOL_DEFAULT_CHANGE_INTERVAL,
        }
        let receipt = await execute(
            "PoolFactory",
            {
                from: deployer,
                log: true,
                gasLimit: DEPLOY_POOL_GAS_LIMIT,
            },
            "deployPool",
            deploymentData
        )
        const event = receipt.events.find((el) => el.event === "DeployPool")
        console.log(`Deployed LeveragedPool: ${event.args.pool}`)
        console.log(`Deployed PoolCommitter: ${event.args.poolCommitter}`)
    }
}

module.exports.tags = ["GoerliDeploy"]
