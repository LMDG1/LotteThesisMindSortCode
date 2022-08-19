import kmeans from 'kmeans-ts';
import Point from '../../common/point';
import ItemPair from '../core/item';

export default abstract class SelectionAlgorithm {
  abstract updateToDo(todo: ItemPair[], currentItemPair: ItemPair): ItemPair[];

  /**
   * Shuffles the array.
   * Code from user "superluminary" on https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
   *
   * @param todo list of item pairs that needs to be studied in this particular order
   * @returns a shuffled list of itempairs, which is the new (shuffled) todo list
   */
  static shuffleArray(todo: ItemPair[]): ItemPair[] {
    const shuffledTodo = todo
      .map((value) => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
    return shuffledTodo;
  }
}

/**
 * This class allows for structuring ItemPairs into clusters.
 */
class Cluster {
  ID: number;
  sortingID: number;
  timesSeen: number;
  itemPairs: ItemPair[];

  constructor(ID: number, itemPairs: ItemPair[]) {
    this.ID = ID; //Cluster-ID
    this.itemPairs = itemPairs;
    this.sortingID = ID; //ID used for sorting the list
    this.timesSeen = 0; //the number of times a cluster has been looped over
  }

  /**
   * Updates the sorting ID of a cluster.
   *
   * @param numberOfClusters the existing number of clusters.
   */
  increaseSortingID(numberOfClusters: number) {
    this.sortingID = (this.sortingID + 1) % numberOfClusters;
  }

  /**
   * Checks whether the number of answers for each item has increased by 1.
   *
   * @returns whether all words in the cluster have been seen once more
   */
  allWordsSeenOnce() {
    return (
      this.itemPairs
        .map((item) => item.answers.length)
        .filter((numberOfAnswers) => numberOfAnswers - this.timesSeen === 1)
        .length === this.itemPairs.length
    );
  }

  /**
   * Checks whether all words of this cluster are seen once in current iteration.
   * If so, it updates the timesSeen variable by 1, indicating that the cluster has been seen once more.
   *
   * @returns the amount of times a cluster has been fully looped over in total
   */
  getTimesSeen(): number {
    if (this.allWordsSeenOnce()) {
      this.timesSeen += 1;
    }
    return this.timesSeen;
  }
}

/**
 * The class that allows for selecting items based on their clusters.
 * It does this based on the (amount of) rounds that are specified.
 *
 */
abstract class ClusteringAlgorithm extends SelectionAlgorithm {
  clusters: Cluster[];
  itemPairs: ItemPair[];
  rounds: number[]; //specify here how often each item should be seen in each round
  roundID: number; //the current round
  neededPreviousRounds: number; //the total amount of times that a cluster should have been looped over
  needThisRound: number; //the total amount of times that a cluster should be looped over in the current round
  needToGoToNextRound: number; //the total amount of times that a cluster should be seen to move onto the next round

  constructor(
    itemPairs: ItemPair[],
    computeClusters: (itemPairs: ItemPair[]) => Cluster[]
  ) {
    super();
    this.clusters = computeClusters(itemPairs);
    console.log("clusters are ", this.clusters);
    this.itemPairs = itemPairs;
    this.rounds = [4, 2, 1]; //in round 0, every item should be seen 4 times, in round 1, 6 times and in round 2, 7 times
    this.roundID = 0;
    this.neededPreviousRounds = 0;
    this.needThisRound = this.rounds[this.roundID];
    this.needToGoToNextRound = this.rounds[this.roundID];
  }

  /**
   * Sorts and updates the todo list.
   * The todo list is sorted in clusters.
   * Each iteration within a cluster has a random selection order.
   * Empties the todo list when each word has been seen the amount of times as specified in rounds.
   *
   * @param todo list of item pairs that needs to be studied in this particular order
   * @param currentItemPair the current item pair that needs to be studied
   * @returns an updated todo list, with a new specific order in which the item pairs need to be studied
   */
  updateToDo(todo: ItemPair[], currentItemPair: ItemPair): ItemPair[] {
    //Sorts the todo list into clusters when it hasn't been sorted yet at the start of a session
    if (this.clusters.length === 0 || currentItemPair === null) {
      todo = this.sortTodoList(todo);
      return todo;
    }

    //If the current item has more answers (= has been seen more times) than needed for this round, advance to next round
    if (currentItemPair.answers.length > this.needToGoToNextRound) {
      this.neededPreviousRounds += this.rounds[this.roundID];
      this.roundID += 1;
      this.needThisRound = this.rounds[this.roundID];
      this.needToGoToNextRound += this.needThisRound;
    }

    //Updates the total amount of times that a cluster has been looped over, i.e. times seen
    const currentCluster = this.getClusterOfItem(currentItemPair);

    const allSeenOnce =
      this.getClusterOfItem(currentItemPair).allWordsSeenOnce();
    const timesSeenThisRound =
      currentCluster.getTimesSeen() - this.neededPreviousRounds;

    //Updates sortingID;s if the items in the current cluster have been seen enough
    if (timesSeenThisRound === this.needThisRound) {
      this.clusters.forEach((c) => c.increaseSortingID(this.clusters.length));
    }

    const previousItem = todo[todo.length - 1];

    //Shuffles the array when all words in a cluster have been seen once
    if (allSeenOnce) {
      todo = ClusteringAlgorithm.shuffleArray(todo);
    }

    todo = this.sortTodoList(todo); //Sorts the todo list based on sortingID's

    //Makes sure the same item pair isn't shown twice back-to-back
    if (todo[0] === previousItem) {
      const currentFirst = todo[0];
      const currentSecond = todo[1];
      if (currentSecond) {
        todo[0] = currentSecond;
        todo[1] = currentFirst;
      } else {
        todo[0] = currentFirst;
      }
    }

    if (this.endOfSession(todo)) {
      todo = [];
    }

    return todo;
  }

  /**
   * Indicates whether every item has as many answers as the total amount of times each item should have been seen.
   *
   * @param todo list of item pairs that needs to be studied in this particular order
   * @returns whether the learning session should end
   */
  endOfSession(todo: ItemPair[]): boolean {
    const totalTimesSeen = this.rounds.reduce((a, b) => a + b);
    return (
      todo.map((i) => i.answers.length).filter((a) => a === totalTimesSeen)
        .length === todo.length && this.roundID + 1 === this.rounds.length
    );
  }

  /**
   * Sort the todo list based on sortingID.
   * The sortingID's are placed into the todo list in ascending order.
   *
   * @param todo list of item pairs that need to be studied in this particular order
   * @returns a sorted version of the todo list
   */
  sortTodoList(todo: ItemPair[]): ItemPair[] {
    return todo.sort((a, b) => {
      return (
        this.getClusterOfItem(a).sortingID - this.getClusterOfItem(b).sortingID
      );
    });
  }

  /**
   * Finds the cluster that a given item belongs to.
   *
   * @param itemPair the item pair of which the cluster ID is returned
   * @returns the cluster of the given itemPair
   */
  getClusterOfItem(itemPair: ItemPair): Cluster {
    return this.clusters.filter((cluster) =>
      cluster.itemPairs.includes(itemPair)
    )[0];
  }
}

/**
 * The class that allows for using kmeans clusters.
 */
export class KMeansClusteringAlgorithm extends ClusteringAlgorithm {
  constructor(itemPairs: ItemPair[]) {
    super(itemPairs, KMeansClusteringAlgorithm.computeClusters);
  }

  /**
   * Clusters a list of item pairs via kmeans into the specified amount.
   * It does this based on the imported kmeans clustering package from https://github.com/GoldinGuy/K-Means-TS.
   *
   * @param itemPairs a list of item pairs
   * @returns a list of clusters
   */
  static computeClusters(itemPairs: ItemPair[]): Cluster[] {
    const clusterAmount = 4; //Specify here the amount of clusters that the list should be divided into

    const points: Point[] = itemPairs.map(
      (item: ItemPair) => item.fromPosition as Point
    ); //Get fromPosition coordinates of every itemPair

    const coordinates: Array<Array<number>> = points.map((point: Point) => [
      point.x as number,
      point.y as number,
    ]); //Map coordinates to a two dimensional array of numbers (x, y)

    const cents = []; //Initial cluster centroids to make sure the clustering for each word list is consistent
    for (let seed = 0.2; seed <= clusterAmount * 0.2; seed += 0.2) {
      const c = coordinates[Math.floor((seed as number) * coordinates.length)];
      cents.push(c);
    }

    const clustersIndexes: Array<number> = kmeans(
      coordinates,
      clusterAmount,
      cents
    ).indexes; //Get cluster for every word (0, 1, 2 or 3) using kmeans function from a kmeans package

    const clusters = clustersIndexes
      .filter((value, index, self) => self.indexOf(value) === index)
      .map(
        (clusterID) =>
          new Cluster(
            clusterID,
            itemPairs.filter(
              (itemPair) => clustersIndexes[itemPair.index] === clusterID
            )
          )
      ); //create a cluster object for every cluster

    return clusters;
  }
}

/**
 * The class that allows for using random clusters.
 */
export class RandomClusteringAlgorithm extends ClusteringAlgorithm {
  constructor(itemPairs: ItemPair[]) {
    super(itemPairs, RandomClusteringAlgorithm.computeClusters);
  }

  /**
   * Randomly clusters a list of item pairs into the specified amount.
   * It fills clusters based on the size of the kmeans clusters for this set of ItemPairs.
   * The kmeans clustering package was imported from https://github.com/GoldinGuy/K-Means-TS.
   *
   * @param itemPairs a list of item pairs
   * @returns a list of clusters
   */
  static computeClusters(itemPairs: ItemPair[]): Cluster[] {
    const clusterAmount = 4; //Specify here the amount of clusters that the list should be divided into

    const points: Point[] = itemPairs.map(
      (item: ItemPair) => item.fromPosition as Point
    ); //Get fromPosition coordinates of every itemPair

    const coordinates: Array<Array<number>> = points.map((point: Point) => [
      point.x as number,
      point.y as number,
    ]); //Map coordinates to a two dimensional array of numbers (x, y)

    const cents = []; //Initial cluster centroids to make sure the clustering for each word list is consistent
    for (let seed = 0.2; seed <= clusterAmount * 0.2; seed += 0.2) {
      const c = coordinates[Math.floor((seed as number) * coordinates.length)];
      cents.push(c);
    }
    const clustersIndexes: Array<number> = kmeans(
      coordinates,
      clusterAmount,
      cents
    ).indexes; //Get cluster for every word (0, 1, 2 or 3) using kmeans function from a kmeans package

    const kmeansClusters = clustersIndexes
      .filter((value, index, self) => self.indexOf(value) === index)
      .map(
        (clusterID) =>
          new Cluster(
            clusterID,
            itemPairs.filter(
              (itemPair) => clustersIndexes[itemPair.index] === clusterID
            )
          )
      ); //Create a cluster object for every cluster

    const neededClusterLengths = kmeansClusters.map((c) => c.itemPairs.length);
    const shuffledItemPairs = RandomClusteringAlgorithm.shuffleArray(itemPairs);
    const randomClusters: Cluster[] = [];
    let totalAddedToCluster = 0; //The number of items in shuffledItemPairs that has been added to a random cluster

    //Fills the random clusters with elements from shuffledItemPairs
    //It makes sure to keep the sizes of the random clusters equal to those of the kmeans clusters.
    for (let i = 0; i < neededClusterLengths.length; i++) {
      let randomItemPairs: ItemPair[] = [];
      randomItemPairs = shuffledItemPairs.slice(
        totalAddedToCluster,
        totalAddedToCluster + neededClusterLengths[i]
      ); //For filling the first cluster, it e.g. takes the first neededClusterLengths[i] elements
      randomClusters[i] = new Cluster(i, randomItemPairs);
      totalAddedToCluster += neededClusterLengths[i];
    }

    return randomClusters;
  }
}

/**
 * This class ensures that the todo list can be shuffled.
 * It is shuffled at the start and when every item has been seen exactly once.
 */
export class RandomAlgorithm extends SelectionAlgorithm {
  todoLength: number;
  iteration: number;
  maxIterations: number;

  constructor(todo: ItemPair[]) {
    super();
    this.todoLength = todo.length;
    this.iteration = 0;
    this.maxIterations = 7; //specify here how many times the list should (randomly) be iterated over
  }

  /**
   * Updates the todo list by shuffling or emptying it.
   * It is shuffled when the maximum number of iterations has not been reached.
   * It is emptied when the maximum number of iterations has been reached.
   *
   * @param todo list of item pairs that need to be studied in this particular order
   * @returns an updated todo list
   */
  updateToDo(todo: ItemPair[]): ItemPair[] {
    if (this.iteration === 0 || this.iteration % this.todoLength === 0) {
      todo = RandomAlgorithm.shuffleArray(todo);
    }
    this.iteration += 1;
    if (this.iteration - 1 === this.maxIterations * this.todoLength) {
      todo = [];
    }
    return todo;
  }
}
