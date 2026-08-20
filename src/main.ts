import { Game } from "./game";

const canvas = document.querySelector("#game-canvas") as HTMLCanvasElement;
const game = new Game(canvas);
(window as unknown as { game: Game }).game = game;
game.start();
