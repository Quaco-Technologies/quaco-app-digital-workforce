from __future__ import annotations

from supabase import Client

from src.repositories.contacts import ContactRepository
from src.repositories.contracts import ContractRepository
from src.repositories.deals import DealRepository
from src.repositories.leads import LeadRepository
from src.repositories.messages import MessageRepository


class Repositories:
    """All repositories bundled — pass this single object through the app."""

    def __init__(self, db: Client):
        self.leads = LeadRepository(db)
        self.contacts = ContactRepository(db)
        self.deals = DealRepository(db)
        self.messages = MessageRepository(db)
        self.contracts = ContractRepository(db)


def get_repos(db: Client) -> Repositories:
    return Repositories(db)
