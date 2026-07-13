"""Place a voice call: upload an audio file, then dispatch it.

Run:  PUSHFY_API_TOKEN=... python3 send_voice.py path/to/welcome.mp3

Credentials come from the environment — never hardcode secrets.
"""

import os
import sys

from pushfy import Pushfy


def main():
    audio_path = sys.argv[1] if len(sys.argv) > 1 else "welcome.mp3"

    pushfy = Pushfy(api_token=os.environ["PUSHFY_API_TOKEN"])

    # 1) Upload the audio once and reuse its id for as many calls as you like.
    with open(audio_path, "rb") as fh:
        audio = pushfy.voice.upload_audio(name="welcome", data=fh.read())
    audio_id = audio["id"]
    print("Uploaded audio:", audio_id)

    # 2) Place the call.
    result = pushfy.voice.send(
        to="5511999999999",
        audio_id=audio_id,
        ext_id="call-001",
    )
    print("Accepted:", result)


if __name__ == "__main__":
    main()
