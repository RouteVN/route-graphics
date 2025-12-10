/**
 * @param {Object} params
 * @param {Object} params.state - The particles state to parse
 * @returns {Object}
 */
export const parseParticles = ({ state }) => {
  return {
    id: state.id,
    type: state.type,
    preset: state.preset ?? "snow",
    count: state.count ?? 100,
  };
};
