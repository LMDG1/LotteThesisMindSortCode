import { GameStatus } from '../../core/game';
import { KMeansClusteringAlgorithm } from '../SelectionAlgorithm';

/**
 * Selects a new a new item given the current game state found in `this`.
 * It selects the next one based on kmeans clusters, using the selectionAlgorithm.
 * If the todo list is empty, it changes the gamestatus to finished.
 * NOTE: use alwaysItemRepeat along with this itemSelect for best performance!
 *
 * @returns the index of the next item (the first item in the 'todo' list)
 */
export default function kmeansClusterItemSelect(): number {
  if (this.selectionAlgorithm === undefined) {
    this.selectionAlgorithm = new KMeansClusteringAlgorithm(this.itemPairs);
  }

  this.todo = this.selectionAlgorithm.updateToDo(this.todo, this.current);

  if (this.todo.length === 0) {
    this.status = GameStatus.Finished;
    return 0;
  }

  return this.todo[0].index;
}
