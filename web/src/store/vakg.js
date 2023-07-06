import axios from "axios";

export const VAKG = process.env.VUE_APP_VAKG_SERVER
  ? axios.create({
      baseURL: `http://${process.env.VUE_APP_VAKG_SERVER}`,
      timeout: 3_600_000, // 60 min in ms
    })
  : undefined;

export function sendVAKGState(curr_state, label, userID, sessionID) {
  if (VAKG) {
    curr_state.graph = null;
    curr_state.clusters.cluster_docs = null;
    curr_state.index = null;
    curr_state.tsne = null;
    curr_state.focused = null;

    console.log("Current State: ", curr_state, label);
    console.log("Sending to VAKG");
    VAKG.post(`/knowledge/new_state`, {
      graph: { id: 0 },
      h_sequence: null,
      m_sequence: {
        state: { label: label, data: curr_state },
        sequence: {
          label: label,
          user: userID,
          analysis: sessionID,
          data: curr_state,
        },
      },
    })
      .then((r) => {
        console.log("VAKG Response: ", r);
      })
      .catch((e) => {
        console.error("VAKG Error: ", e);
      });
  }
}
