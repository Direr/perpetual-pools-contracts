import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { ethers } from "hardhat"
import { PoolFactory, PoolKeeper } from "../../types"
import { DEFAULT_FEE, POOL_CODE } from "../constants"
import {
    deployPoolAndTokenContracts,
    generateRandomAddress,
} from "../utilities"

chai.use(chaiAsPromised)
const { expect } = chai

describe("PoolFactory - setters", async () => {
    let factory: PoolFactory
    let signers: SignerWithAddress[]
    let keeper: PoolKeeper

    beforeEach(async () => {
        signers = await ethers.getSigners()
        const result = await deployPoolAndTokenContracts(
            POOL_CODE,
            2, // frontRunningInterval
            5, // updateInterval
            1,
            signers[0].address,
            DEFAULT_FEE
        )
        factory = result.factory
        keeper = result.poolKeeper
    })

    context("updateFeeAddress", async () => {
        it("should set fee address", async () => {
            await factory.setFeeReceiver(signers[1].address)
            expect(await factory.feeReceiver()).to.eq(signers[1].address)
        })
        it("should prevent unauthorized access", async () => {
            await factory.setFeeReceiver(signers[1].address)
            await expect(
                factory.connect(signers[2]).setFeeReceiver(signers[2].address)
            ).to.be.revertedWith("msg.sender not governance")
        })
    })

    context("setKeeper", async () => {
        it("should set the keeper address", async () => {
            expect(await factory.poolKeeper()).to.eq(keeper.address)
            await factory.setPoolKeeper(signers[1].address)
            expect(await factory.poolKeeper()).to.eq(signers[1].address)
        })
        it("should prevent unauthorized access", async () => {
            await factory.setPoolKeeper(signers[1].address)
            await expect(
                factory.connect(signers[2]).setPoolKeeper(signers[2].address)
            ).to.be.revertedWith("msg.sender not governance")
        })
    })

    context("transferGovernance", async () => {
        it("should set the provisional governance address", async () => {
            await factory.transferGovernance(signers[1].address)
            expect(await factory.provisionalGovernance()).to.eq(
                signers[1].address
            )
        })
        it("should prevent unauthorized access", async () => {
            await factory.transferGovernance(signers[1].address)
            await expect(
                factory
                    .connect(signers[2])
                    .transferGovernance(signers[2].address)
            ).to.be.rejectedWith("msg.sender not governance")
        })
    })

    describe("claimGovernance", async () => {
        context(
            "When governance transfer is in progress and called by provisional governor",
            async () => {
                it("Sets the actual governance address to the provisional governance address", async () => {
                    /* start governance transfer */
                    await factory.transferGovernance(signers[1].address)

                    /* claim governance */
                    await factory.connect(signers[1]).claimGovernance()

                    expect(await factory.governance()).to.be.eq(
                        signers[1].address
                    )
                })

                it("Sets the governance transfer flag to false", async () => {
                    /* start governance transfer */
                    await factory.transferGovernance(signers[1].address)

                    /* claim governance */
                    await factory.connect(signers[1]).claimGovernance()

                    expect(
                        await factory.governanceTransferInProgress()
                    ).to.be.eq(false)
                })
            }
        )

        context(
            "When governance transfer is not in progress and called by provisional governor",
            async () => {
                it("Reverts", async () => {
                    /* attempt to claim governance */
                    await expect(
                        factory.connect(signers[1]).claimGovernance()
                    ).to.be.revertedWith("No governance change active")
                })
            }
        )

        context(
            "When governance transfer is not in progress and called by a non-provisional governor",
            async () => {
                it("Reverts", async () => {
                    /* attempt to claim governance */
                    await expect(
                        factory.connect(signers[2]).claimGovernance()
                    ).to.be.revertedWith("No governance change active")
                })
            }
        )

        context(
            "When governance transfer is in progress and called by a non-provisional governor",
            async () => {
                it("Reverts", async () => {
                    /* start governance transfer */
                    await factory.transferGovernance(signers[1].address)

                    /* attempt to claim governance */
                    await expect(
                        factory.connect(signers[2]).claimGovernance()
                    ).to.be.revertedWith("Not provisional governor")
                })
            }
        )
    })

    context("setDeploymentFee", async () => {
        it("should set the deployment deployment fee params", async () => {
            const tokenAddress = generateRandomAddress()
            const feeAmount = ethers.utils.parseEther("2")
            const feeReceiver = generateRandomAddress()
            await factory.setDeploymentFee(tokenAddress, feeAmount, feeReceiver)
            expect(await factory.deploymentFee()).to.eq(feeAmount)
            expect(await factory.deploymentFeeToken()).to.eq(tokenAddress)
            expect(await factory.deploymentFeeReceiver()).to.eq(feeReceiver)
        })

        it("should prevent unauthorized access", async () => {
            const tokenAddress = generateRandomAddress()
            const feeAmount = ethers.utils.parseEther("2")
            const feeReceiver = generateRandomAddress()
            await expect(
                factory
                    .connect(signers[2])
                    .setDeploymentFee(tokenAddress, feeAmount, feeReceiver)
            ).to.be.revertedWith("msg.sender not governance")
        })
    })
})
