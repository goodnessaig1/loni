from pydantic import BaseModel, Field
from app.modules.users.models import AccountStatusEnum

class UpdateAccountStatusRequest(BaseModel):
    status: AccountStatusEnum = Field(..., description="The new status of the account, e.g. 'active', 'pending', or 'suspended'")
