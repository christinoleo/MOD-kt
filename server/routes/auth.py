from routes import LOGGER, fetch_user, UserData
from routes import ErrorResponse
from pydantic import BaseModel
from fastapi import APIRouter
import os
from utils.path import user_path


class AuthForm(BaseModel):
    userId: str


class AuthResponse(BaseModel):
    status: str = "Success"
    userData: UserData


router = APIRouter(prefix="/auth")


@router.post("")
# Authetication
#   Returns the userData if success
def auth(form: AuthForm):
    try:
        if not os.path.exists(user_path):
            # If it doesn't exist, create it
            os.makedirs(user_path)
            LOGGER.info(f"Created {user_path}")
        if not os.path.exists(f"{user_path}/{form.userId}"):
            os.makedirs(f"{user_path}/{form.userId}")
            LOGGER.info(f"Created {user_path}/{form.userId}")
        user = fetch_user(userId=form.userId)
        response = {"userData": user.userData()}
        return AuthResponse(**response)
    except Exception as e:
        LOGGER.error(e)
        response = {"message": {"title": str(type(e)), "content": str(e)}}
        return ErrorResponse(**response)
