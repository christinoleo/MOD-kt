<template>
  <div class="w-100 flex">
    <b-button
      id="fab-btn"
      class="mr-1"
      :variant="
        this.isRecording ? 'danger' : this.isSending ? 'warning' : 'info'
      "
      @click="(event) => toggleMicrophone(event)"
    >
      <font-awesome-icon :icon="['fas', 'microphone']" />&nbsp;
    </b-button>
    <div v-text="transcript"></div>
    <b-form-input
      v-model="VAKGThoughts"
      v-text="VAKGThoughts"
      :disabled="this.isRecording || this.isSending"
      placeholder="enter your thoughts"
      @keydown.native="thoughts_keydown_handler"
      class="form-control"
    >
    </b-form-input>
  </div>
</template>

<script>
import { mapActions } from "vuex";

export default {
  name: "VAKGInput",
  data() {
    return {
      transcript: "",
      VAKGThoughts: "",
      isRecording: false,
      isSending: false,
      sr: null,
    };
  },
  mounted() {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    console.log("VAKGInput mounted", Recognition);
    this.sr = new Recognition();

    this.sr.lang = "en-US";
    this.sr.continuous = true;
    // this.sr.interimResults = true;
    // this.sr.maxAlternatives = 1;
    this.sr.onresult = (event) => {
      //   this.transcript = event.results[0][0].transcript;
      const currTranscript = Array.from(event.results).map(
        (r) => r[0].transcript
      );
      const transcript = currTranscript[currTranscript.length - 1];
      console.log("Spoke", transcript);
      this.VAKGThoughts = "(sending speech): " + transcript;
      this.sr.stop();
      this.isSending = true;
      this.newThought(this.VAKGThoughts).then(() => {
        console.log("Empty", this.VAKGThoughts);
        this.VAKGThoughts = "";
        this.isSending = false;
        // this.sr.start();
      });
      //   console.log(this.transcript, currTranscript[currTranscript.length - 1]);
    };
    this.sr.onstart = () => {
      this.isRecording = true;
      console.log("Speech recognition service has started", this.isRecording);
    };
    this.sr.onend = (e) => {
      this.isRecording = false;
      console.log("Speech recognition service stopped", this.isRecording, e);
    };
    this.sr.onerror = function(event) {
      console.error(event);
    };
  },
  methods: {
    toggleMicrophone(event) {
      console.log("toggleMicrophone");
      if (!this.sr) return;
      if (event) {
        event.preventDefault();
        console.log("toggleMicrophone preventDefault");
      }
      if (this.isRecording) {
        console.log("toggleMicrophone stop");
        this.sr.stop();
      } else {
        console.log("toggleMicrophone start");
        this.sr.start();
      }
    },
    thoughts_keydown_handler(event) {
      if (this.VAKG && event.which === 13) {
        console.log("Enter pressed", this.VAKGThoughts);
        this.isSending = true;
        this.newThought(this.VAKGThoughts).then(() => {
          this.VAKGThoughts = "";
          this.isSending = false;
        });
      }
    },
    ...mapActions(["newThought"]),
  },
};
</script>

<style>
.flex {
  display: flex;
}
</style>
