from typing import Optional, List
from pydantic import BaseModel


class ReadinessSignal(BaseModel):
    name: str
    passed: bool
    label: Optional[str] = None


class ReadinessResponse(BaseModel):
    score: int
    signals: List[ReadinessSignal]
    cycle_active: bool
    prompts: List[str]
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
