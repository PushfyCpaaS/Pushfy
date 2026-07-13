"""Place a voice call: upload an audio file under a name, then dispatch it.

The upload response does NOT contain an audio id — the audio is identified by
the name you choose. Use that same name when placing the call.

Run:  PUSHFY_API_TOKEN=... python3 send_voice.py path/to/welcome.mp3

Credentials come from the environment — never hardcode secrets.
"""

import os
import sys

from pushfy import Pushfy


def main():
    audio_path = sys.argv[1] if len(sys.argv) > 1 else "welcome.mp3"

    pushfy = Pushfy(api_token=os.environ["PUSHFY_API_TOKEN"])

    # The name identifies the audio on both steps. Keep upload and call in sync.
    audio_name = os.environ.get("PUSHFY_AUDIO_NAME", "Welcome message")

    # 1) Upload the audio once under audio_name and reuse that name for as many calls as you like.
    with open(audio_path, "rb") as fh:
        pushfy.voice.upload_audio(name=audio_name, data=fh.read())
    print("Uploaded audio:", audio_name)

    # 2) Place the call, referencing the audio by the same name.
    result = pushfy.voice.send(
        to="5511999999999",
        audio_name=audio_name,
        ext_id="call-001",
    )
    print("Accepted:", result)


if __name__ == "__main__":
    main()
