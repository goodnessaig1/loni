"""Move community counters into community_post_stats

Revision ID: f3b7d2a9c581
Revises: e8a2c6d1f947
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3b7d2a9c581'
down_revision: Union[str, Sequence[str], None] = 'e8a2c6d1f947'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'community_post_stats',
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('like_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('comment_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('view_count', sa.Integer(), server_default='0', nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('post_id'),
    )
    op.execute(
        "INSERT INTO community_post_stats (post_id, like_count, comment_count, view_count) "
        "SELECT id, like_count, comment_count, view_count FROM community_posts"
    )
    op.drop_column('community_posts', 'like_count')
    op.drop_column('community_posts', 'comment_count')
    op.drop_column('community_posts', 'view_count')


def downgrade() -> None:
    for col in ('like_count', 'comment_count', 'view_count'):
        op.add_column('community_posts', sa.Column(col, sa.Integer(), server_default='0', nullable=False))
    op.execute(
        "UPDATE community_posts SET like_count = s.like_count, comment_count = s.comment_count, "
        "view_count = s.view_count FROM community_post_stats s WHERE s.post_id = community_posts.id"
    )
    op.drop_table('community_post_stats')
