import ItemPair from '../../../common/item';

/**
 * Always repeats items as long as the todo list has items.
 * When the todo list is empty, items aren't repeated anymore.
 *
 * @param current The current question (which is the correct answer)
 * @param isCorrect whether or not givenAnswer is correct, determined by `item.checkAnswer()`
 * @param givenAnswer The answer given by the player
 * @returns whether or not `current` should be repeated.
 */
export default function alwaysItemRepeat(
  current: ItemPair,
  isCorrect: boolean,
  _givenAnswer: ItemPair | null = null
): boolean {
  return this.todo.length !== 0;
}
