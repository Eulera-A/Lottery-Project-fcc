const { getNamedAccounts, network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { assert } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Test", function () {
      let raffle, VRFCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        raffle = await ethers.getContract("Raffle", deployer);
        VRFCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        raffleEntranceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();
      });

      describe("Constructor", function () {
        it("Initializes the raffle correctly", async function () {
          const raffleState = await raffle.getRaffleState();
          const interval = await raffle.getInterval();
          assert.equal(raffleState.toString(), "0");
          assert.equal(
            interval.toString(),
            networkConfig[chainId]["keepersUpdateInterval"]
          );
        });
      });

      describe("enterRaffle", function () {
        it("reverts when you don't pay enough", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWith(
            "Rffle__NotEnoughETHEntered"
          );
        });
        it("records players when they enter", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const playerFromContract = await raffle.getPlayer(0);
          assert.equal(playerFromContract, deployer);
        });

        it("emits event on enter", async function () {
          await expect(
            raffle.enterRaffle({ value: raffleEnteranceFee })
          ).to.emit(raffle, "RaffleEnter");
        });
      });

      // 15:35
      it("doesn't allow entrance when raffle is calculating ", async function () {
        await raffle.enterRaffle({ value: raffleEntranceFee });
        await network.provider.send("evm_increaseTime", [
          interval.toNumber() + 1,
        ]);
        await network.provider.send(["evm_mine", []]);

        // we pretend to be a chainlink keeper
        await raffle.performUpkeep([]);
        await expect(
          raffle.enterRaffle({ value: raffleEnteranceFee })
        ).to.be.revertedWith("Raffle__NotOpen");
      });

      describe("checkUpkeep", async function () {
        it("returns false if people haven't sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeeper([]);
          assert(!upkeepNeeded); // because the open balance is 0???
        });

        it("returns false if raffle isn't open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee }); // input entrance fee
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]); // ensure enough time passed on evm
          await network.provider.send("evm_mine", []); //notify evm to mine
          await raffle.performUpkeep([]); // since all above passed, closed for calculating
          const raffleState = await raffle.getRaffleState(); // state should be closed now
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeeper();
          assert.equal(raffleState.toString(), "1");
          assert.equal(upkeepNeeded, false);
        });

        it("returns false if enough time hasn't passed", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 5,
          ]); // use a higher number here if this test fails
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded);
        });
        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", function () {
        it("it can only run if checkupkeep is true", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const tx = await raffle.performUpkeep([]);
          assert(tx);
        });
        it("reverts when checkUpkeep is false", async function () {
          await expect(
            raffle
              .performUpkeep([])
              .to.be.revertedWith("Raffle__UpkeepNotNeeded")
          );
        });
        it("it updates the raffle state, emits and event, and calls the vrf coordinator", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const txResponse = await raffle.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.events[1];
        });
      });
    });
