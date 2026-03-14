import LudoToken from "../LudoToken";

/**
 * Renders a stack of tokens that share a single board cell.
 * Shows up to 3 tokens with slight offsets; a badge shows the overflow count.
 *
 * Props:
 *   tokens         - array of { color, playerIndex, tokenIndex }
 *   size           - LudoToken size prop ("base" | "small")
 *   isTokenMovable - (playerIndex, tokenIndex) => boolean
 *   isTokenSelected- (playerIndex, tokenIndex) => boolean
 *   onTokenClick   - (playerIndex, tokenIndex) => void
 *   moveAnimation  - { playerIndex, tokenIndex, direction } | null
 */
const TokenStack = ({
  tokens,
  size = "base",
  isTokenMovable,
  isTokenSelected,
  onTokenClick,
  moveAnimation,
}) => {
  if (!tokens || tokens.length === 0) return null;

  const getDirection = (playerIndex, tokenIndex) => {
    if (
      moveAnimation &&
      moveAnimation.playerIndex === playerIndex &&
      moveAnimation.tokenIndex === tokenIndex
    ) {
      return moveAnimation.direction;
    }
    return null;
  };

  if (tokens.length === 1) {
    const t = tokens[0];
    return (
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <LudoToken
          color={t.color}
          number={t.tokenIndex}
          isMovable={isTokenMovable(t.playerIndex, t.tokenIndex)}
          isSelected={isTokenSelected(t.playerIndex, t.tokenIndex)}
          onClick={() => onTokenClick(t.playerIndex, t.tokenIndex)}
          size={size}
          bounceDirection={getDirection(t.playerIndex, t.tokenIndex)}
        />
      </div>
    );
  }

  const displayTokens = tokens.slice(0, 3);
  const extra = tokens.length - 3;
  const offsets = [
    { top: "0", left: "0" },
    { top: "0", left: "45%" },
    { top: "45%", left: "20%" },
  ];

  return (
    <div className="absolute inset-0 z-10">
      <div className="relative w-full h-full">
        {displayTokens.map((t, i) => (
          <div key={i} className="absolute" style={offsets[i]}>
            <LudoToken
              color={t.color}
              number={t.tokenIndex}
              isMovable={isTokenMovable(t.playerIndex, t.tokenIndex)}
              isSelected={isTokenSelected(t.playerIndex, t.tokenIndex)}
              onClick={() => onTokenClick(t.playerIndex, t.tokenIndex)}
              size="base"
              bounceDirection={getDirection(t.playerIndex, t.tokenIndex)}
            />
          </div>
        ))}
        {extra > 0 && (
          <div className="absolute -top-1 -right-1 bg-gray-800 text-white text-[7px] rounded-full w-3.5 h-3.5 flex items-center justify-center z-20 leading-none">
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenStack;
