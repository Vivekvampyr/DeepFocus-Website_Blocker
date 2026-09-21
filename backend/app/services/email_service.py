import os

from dotenv import load_dotenv
from brevo import Brevo
from brevo.transactional_emails import (
    SendTransacEmailRequestSender,
    SendTransacEmailRequestToItem,
)


load_dotenv()


BREVO_API_KEY = os.getenv("BREVO_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL")
FROM_NAME = os.getenv("FROM_NAME", "DeepFocus")


if not BREVO_API_KEY:
    raise RuntimeError("BREVO_API_KEY is not set in .env")


if not FROM_EMAIL:
    raise RuntimeError("FROM_EMAIL is not set in .env")


client = Brevo(
    api_key=BREVO_API_KEY,
    timeout=10.0,
)


def send_password_reset_email(
    email: str,
    reset_url: str,
):
    client.transactional_emails.send_transac_email(
        subject="Reset your DeepFocus password",
        html_content=f"""
            <html>
                <body>
                    <h2>Reset your DeepFocus password</h2>

                    <p>
                        We received a request to reset your
                        DeepFocus password.
                    </p>

                    <p>
                        Click the button below to choose a
                        new password:
                    </p>

                    <p>
                        <a
                            href="{reset_url}"
                            style="
                                display: inline-block;
                                padding: 10px 18px;
                                background: #c9a227;
                                color: #15171c;
                                text-decoration: none;
                                border-radius: 6px;
                                font-weight: 600;
                            "
                        >
                            Reset Password
                        </a>
                    </p>

                    <p>
                        This link will expire in 1 hour.
                    </p>

                    <p>
                        If you did not request a password reset,
                        you can safely ignore this email.
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
                email=email,
            )
        ],
        request_options={
            "timeout_in_seconds": 10,
            "max_retries": 0,
        },
    )