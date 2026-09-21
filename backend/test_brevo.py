import os
from dotenv import load_dotenv
from brevo import Brevo
from brevo.transactional_emails import (SendTransacEmailRequestSender, SendTransacEmailRequestToItem)

load_dotenv()

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL")
FROM_NAME = os.getenv("FROM_NAME", "DeepFocus")
TEST_EMAIL = os.getenv("TEST_EMAIL")

if not BREVO_API_KEY:
    raise RuntimeError("BREVO_API_KEY is not set in .env")

if not FROM_EMAIL:
    raise RuntimeError("FROM_EMAIL is not set in .env")

if not TEST_EMAIL:
    raise RuntimeError("TEST_EMAIL is not set in .env")

client = Brevo(
    api_key=BREVO_API_KEY,
    timeout=10.0,
)


try:
    result = client.transactional_emails.send_transac_email(
        subject="DeepFocus Brevo Test",
        html_content="""
            <html>
                <body>
                    <h2>DeepFocus Email Test</h2>
                    <p>
                        This is a test email sent through
                        the Brevo API.
                    </p>
                    <p>
                        If you received this message,
                        Brevo is working correctly.
                    </p>
                </body>
            </html>
        """,
        sender=SendTransacEmailRequestSender(
            name=FROM_NAME,
            email=FROM_EMAIL,
        ),
        to=[
            SendTransacEmailRequestToItem(
                email=TEST_EMAIL,
            )
        ],
        request_options={
            "timeout_in_seconds": 10,
            "max_retries": 0,
        },
    )

    print("Brevo email sent successfully.")
    print(f"Message ID: {result.message_id}")

except Exception as error:
    print("Brevo email failed.")
    print(f"Type: {type(error).__name__}")
    print(f"Error: {error!r}")