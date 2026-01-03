/**
 * انواع بازی‌ها
 */
export enum GameType {
  ROCK_PAPER_SCISSORS = 'rock_paper_scissors',
  TIC_TAC_TOE = 'tic_tac_toe',
  TRUTH_OR_DARE = 'truth_or_dare',
}

/**
 * وضعیت بازی
 */
export enum GameStatus {
  WAITING = 'waiting',        // در انتظار شروع
  IN_PROGRESS = 'in_progress', // در حال انجام
  COMPLETED = 'completed',     // تمام شده
  CANCELLED = 'cancelled',     // لغو شده
}

/**
 * انتخاب‌های سنگ کاغذ قیچی
 */
export enum RPSChoice {
  ROCK = 'rock',       // سنگ
  PAPER = 'paper',     // کاغذ
  SCISSORS = 'scissors', // قیچی
}

/**
 * نتیجه راند
 */
export enum RoundResult {
  PLAYER1_WIN = 'player1_win',
  PLAYER2_WIN = 'player2_win',
  DRAW = 'draw',
}

/**
 * اطلاعات بازی سنگ کاغذ قیچی
 */
export interface RockPaperScissorsGame {
  id: number;
  chat_id: number;
  player1_id: number;
  player2_id: number;
  current_round: number;
  max_rounds: number;
  player1_score: number;
  player2_score: number;
  status: GameStatus;
  created_at: Date;
  completed_at?: Date;
  winner_id?: number;
}

/**
 * اطلاعات راند بازی
 */
export interface GameRound {
  id: number;
  game_id: number;
  round_number: number;
  player1_choice?: RPSChoice;
  player2_choice?: RPSChoice;
  result?: RoundResult;
  created_at: Date;
  completed_at?: Date;
}

/**
 * وضعیت بازی برای نمایش
 */
export interface GameState {
  game: RockPaperScissorsGame;
  currentRound: GameRound;
  player1HasChosen: boolean;
  player2HasChosen: boolean;
  isCompleted: boolean;
}

/**
 * جلسه بازی عمومی
 */
export interface GameSession {
  id: number;
  chat_id: number;
  game_type: GameType;
  status: GameStatus;
  player1_id: number;
  player2_id: number;
  game_data: any;
  winner_id: number | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

/**
 * داده‌های بازی RPS در game_data
 */
export interface RPSGameData {
  rounds: RPSRound[];
  current_round: number;
  max_rounds: number;
  scores: {
    player1: number;
    player2: number;
  };
}

/**
 * اطلاعات یک راند RPS
 */
export interface RPSRound {
  round_number: number;
  player1_choice: RPSChoice | null;
  player2_choice: RPSChoice | null;
  result: RoundResult | null;
  completed_at: Date | null;
}
