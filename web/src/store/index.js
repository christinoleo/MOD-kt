import Vue from "vue";
import Vuex from "vuex";
import axios from "axios";

import userData from "./modules/userData";
import session from "./modules/session";
import sankey from "./modules/sankey";
import { sendVAKGState, VAKG } from "./vakg";

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    userData,
    session,
    sankey,
  },
  plugins: [
    (store) => {
      store.subscribe((mutations, state) => {
        console.log("mutations", mutations, JSON.parse(JSON.stringify(state)));
        const when = [
          "session/setSelected",
          "session/updateSelected",
          "session/setWordSimilarity",
          "session/setProjection",
          "session/setPerplexity",
          "session/setDistance",
          "session/setCharge",
          "session/setLinkDistance",
        ];
        if (when.includes(mutations.type)) {
          const curr_state = JSON.parse(JSON.stringify(state.session));
          sendVAKGState(
            curr_state,
            mutations.type,
            state.userData.userId,
            state.session.name
          );
        }
      }),
        store.subscribeAction({
          after: (action, state) => {
            // console.log("ations", action, JSON.parse(JSON.stringify(state)));
            const when = ["cluster", "getUserData"];
            if (when.includes(action.type)) {
              const curr_state = JSON.parse(JSON.stringify(state.session));
              sendVAKGState(
                curr_state,
                action.type,
                state.userData.userId,
                state.session.name
              );
            }
          },
        });
    },
  ],
  state: {
    HTTP: axios.create({
      baseURL: `http://${process.env.VUE_APP_SERVER_HOST}${process.env.VUE_APP_SERVER_PREFIX}/api`,
      timeout: 3_600_000, // 60 min in ms
    }),
  },
  actions: {
    async newThought({ state }, thought) {
      return new Promise((resolve, reject) => {
        if (!thought) reject();
        VAKG.post(
          "/nlp/similar/" + thought,
          { min_score: 0.7 },
          {
            headers: { "Content-Type": "application/json" },
          }
        )
          .then((r) => {
            const lemmas = r.data.lemmas;
            lemmas.sort();
            const suggestions = r.data.suggestions;
            console.log("VAKG NLP Response: ", r, lemmas, suggestions);

            VAKG.post(`/knowledge/new_state`, {
              graph: { id: 0 },
              m_sequence: null,
              h_sequence: {
                state: { label: "newThought", data: { lemmas: lemmas } },
                sequence: {
                  label: "newThought",
                  data: {
                    lemmas:
                      suggestions.length === 0 || suggestions[0].score > 0.8
                        ? lemmas
                        : suggestions[0].lemmas,
                    text: thought,
                  },
                  user: state.userData.userId,
                  analysis: state.session.name,
                  text: thought,
                  lemmas: lemmas,
                },
              },
            })
              .then((r) => {
                console.log("VAKG NEW THOUGHT Response: ", r);
                resolve(r);
              })
              .catch((e) => {
                console.error("VAKG  NEW THOUGHT Error: ", e);
                reject(e);
              });
          })
          .catch((e) => {
            console.error("VAKG NLP Error: ", e);
            reject(e);
          });
      });
      // });

      //   return new Promise((resolve, reject) => {
      //     state.VAKG.post("/similar/" + thought, {}, {
      //       headers: { "Content-Type": "application/json" },
      //     })
      //       .then((r) => {
      //         resolve(r);
      //       })
      //       .catch((e) => {
      //         reject(e);
      //       });
      //   });
    },
    async getUserData({ commit, state }, userId) {
      let jsonData = { userId: userId };
      console.log("User Data", jsonData);

      return new Promise((resolve, reject) => {
        state.HTTP.post("/auth", jsonData, {
          headers: { "Content-Type": "application/json" },
        })
          .then(({ data }) => {
            commit("userData/setUserId", data.userData.userId);
            commit(
              "userData/setCorpus",
              data.userData.corpus.map((doc) => doc)
            );
            commit(
              "userData/setSessions",
              data.userData.sessions.map((session) => session)
            );
            commit("userData/setIsProcessed", data.userData.isProcessed);
            commit("userData/setStopwords", data.userData.stop_words);

            data = null;
            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async clearUserData({ commit, state }) {
      let jsonData = {
        userId: state.userData.userId,
        RESET_FLAG: true,
      };

      return new Promise((resolve, reject) => {
        state.HTTP.post("/corpus", jsonData, {
          headers: { "Content-Type": "application/json" },
        })
          .then(() => {
            commit("userData/clearUserData");

            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async uploadDocument({ commit, state }, formData) {
      return new Promise((resolve, reject) => {
        state.HTTP.put("/corpus", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
          .then((result) => {
            console.trace("Submit", result.data);
            commit(
              "userData/pushCorpus",
              result.data.newData.map((d) => d)
            );
            resolve(result);
            result = null;
          })
          .catch((error) => reject(error));
      });
    },
    async deleteDocument({ commit, state }, { to_remove, RESET_FLAG }) {
      let jsonData = {
        userId: state.userData.userId,
        ids: to_remove,
        RESET_FLAG: RESET_FLAG,
      };

      return new Promise((resolve, reject) => {
        state.HTTP.post("/corpus", jsonData, {
          headers: { "Content-Type": "application/json" },
        })
          .then(() => {
            commit("userData/removeFromCorpus", to_remove);
            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async cluster({ commit, state }, cluster_k = null) {
      console.log(cluster_k);
      let jsonData = {
        userId: state.userData.userId,
        recluster: cluster_k == null ? true : false,
        cluster_k:
          cluster_k != null ? cluster_k : state.session.clusters.cluster_k,
        seed: cluster_k == null ? state.session.clusters : {},
        index: cluster_k == null ? state.session.index : [],
      };

      return new Promise((resolve, reject) => {
        console.log(jsonData);
        state.HTTP.post("/cluster", jsonData, {
          headers: { "Content-Type": "application/json" },
        })
          .then(({ data }) => {
            let session = data.sessionData;

            if (cluster_k != null) {
              commit("session/setId", session.id);
              commit("session/setName", session.name);
              commit("session/setNotes", session.notes);
              commit(
                "session/setIndex",
                session.index.map((id) => id)
              );
              commit("session/setGraph", session.graph);
              commit(
                "session/setTsne",
                session.tsne.map((d) => d)
              );
              commit("session/setControls", session.controls);
              commit("session/setDate", session.date);
              commit(
                "session/setSelected",
                session.selected.map((d) => d)
              );
              commit("session/setFocused", session.focused);
              commit("session/setHighlight", session.highlight);
              commit("session/setWordSimilarity", session.word_similarity);
            }

            commit("session/setClusters", session.clusters);

            data = null;
            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async processCorpus({ commit, state }, setting) {
      let jsonData = {
        userId: state.userData.userId,
        word_model: setting.word,
        document_model: setting.document,
        stop_words: state.userData.stop_words,
      };

      return new Promise((resolve, reject) => {
        state.HTTP.post("/process_corpus", jsonData, {
          headers: { "Content-Type": "application/json" },
        })
          .then(({ data }) => {
            commit("userData/setUserId", data.userData.userId);
            commit(
              "userData/setCorpus",
              data.userData.corpus.map((doc) => doc)
            );
            commit(
              "userData/setSessions",
              data.userData.sessions.map((session) => session)
            );
            commit("userData/setIsProcessed", true);

            data = null;
            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async getSessionById({ commit, state }, sessionId) {
      return new Promise((resolve, reject) => {
        state.HTTP.get("/session", {
          params: {
            userId: state.userData.userId,
            sessionId: sessionId,
          },
        })
          .then(({ data }) => {
            let session = data.sessionData;

            commit("session/setId", session.id);
            commit("session/setName", session.name);
            commit("session/setNotes", session.notes);
            commit(
              "session/setIndex",
              session.index.map((id) => id)
            );
            commit("session/setGraph", session.graph);
            commit(
              "session/setTsne",
              session.tsne.map((d) => d)
            );
            commit("session/setClusters", session.clusters);
            commit("session/setControls", session.controls);
            commit("session/setDate", session.date);
            commit(
              "session/setSelected",
              session.selected.map((d) => d)
            );
            commit("session/setFocused", session.focused);
            commit("session/setHighlight", session.highlight);
            commit("session/setWordSimilarity", session.word_similarity);

            data = null;
            session = null;
            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async getProjection({ commit, state }) {
      let jsonData = {
        userId: state.userData.userId,
        projection: state.session.controls.projection,
        index: state.session.index,
        perplexity: state.session.controls.tsne.perplexity,
      };

      return new Promise((resolve, reject) => {
        state.HTTP.post("/projection", jsonData, {
          headers: { "Content-Type": "application/json" },
        })
          .then(({ data }) => {
            commit(
              "session/setTsne",
              data.projection.map((d) => d)
            );

            data = null;
            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async getMostSimilar({ state, commit }) {
      let jsonData = {
        userId: state.userData.userId,
        query: state.session.word_similarity.query,
      };

      return new Promise((resolve, reject) => {
        state.HTTP.post("/word_similarity", jsonData, {
          headers: { "Content-Type": "application/json" },
        })
          .then(({ data }) => {
            commit("session/setWordSimilarity", {
              query: data.query,
              most_similar: data.most_similar,
            });

            data = null;
            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async saveSession({ commit, getters, state }) {
      let jsonData = {
        userId: state.userData.userId,
        sessionData: getters["session/session"],
      };

      return new Promise((resolve, reject) => {
        state.HTTP.put("/session", jsonData, {
          headers: { "Content-Type": "application/json" },
        })
          .then(({ data }) => {
            commit("session/setId", data.sessionData.id);
            commit("session/setDate", data.sessionData.date);

            data = null;
            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async deleteSession({ state }, sessionId) {
      let jsonData = {
        userId: state.userData.userId,
        sessionId: sessionId,
      };

      return new Promise((resolve, reject) => {
        state.HTTP.post("/session", jsonData, {
          headers: { "Content-Type": "application/json" },
        })
          .then(() => {
            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async updateCorpus({ state, commit }, newData) {
      let jsonData = {
        userId: state.userData.userId,
        seed: state.session.clusters,
        new_docs: newData,
      };

      return new Promise((resolve, reject) => {
        state.HTTP.put("/process_corpus", jsonData, {
          headers: { "Content-Type": "application/json" },
        })
          .then(({ data }) => {
            let newData = data.newData;

            // SESSION UPDATE
            commit(
              "session/setTsne",
              newData.tsne.map((d) => d)
            );
            commit("session/setGraph", newData.graph);
            commit(
              "session/setIndex",
              newData.index.map((d) => d)
            );
            commit(
              "session/setNewDocs",
              newData.new_index.map((d) => d)
            );
            commit("session/setClusters", newData.clusters);

            // USER DATA UPDATE
            commit(
              "userData/setCorpus",
              newData.corpus.map((doc) => doc)
            );

            data = null;
            newData = null;
            resolve();
          })
          .catch((error) => reject(error));
      });
    },
    async requestSankeyGraph({ state, commit }, userId) {
      return new Promise((resolve, reject) => {
        state.HTTP.get("/sankey", {
          params: { userId: userId },
        })
          .then(({ data }) => {
            commit("sankey/setGraph", data);
            resolve();
            data = null;
          })
          .catch((error) => reject(error));
      });
    },
  },
});
