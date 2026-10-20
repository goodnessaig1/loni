"""Add community feed (posts, likes, comments, views)

Revision ID: e8a2c6d1f947
Revises: b4d6e91a7c23
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8a2c6d1f947'
down_revision: Union[str, Sequence[str], None] = 'b4d6e91a7c23'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'community_posts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('author_id', sa.String(length=12), nullable=False),
        sa.Column('body', sa.Text(), server_default='', nullable=False),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('like_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('comment_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('view_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_community_posts_id'), 'community_posts', ['id'], unique=False)
    op.create_index(op.f('ix_community_posts_author_id'), 'community_posts', ['author_id'], unique=False)
    op.create_index('ix_community_posts_feed', 'community_posts', ['created_at', 'id'], unique=False)

    op.create_table(
        'community_likes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=12), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('post_id', 'user_id', name='uq_community_like_post_user'),
    )
    op.create_index(op.f('ix_community_likes_user_id'), 'community_likes', ['user_id'], unique=False)

    op.create_table(
        'community_comments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('author_id', sa.String(length=12), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_community_comments_post', 'community_comments', ['post_id', 'id'], unique=False)

    op.create_table(
        'community_views',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=12), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('post_id', 'user_id', name='uq_community_view_post_user'),
    )
    op.create_index(op.f('ix_community_views_user_id'), 'community_views', ['user_id'], unique=False)
    op.create_index('ix_community_views_recent', 'community_views', ['post_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_community_views_recent', table_name='community_views')
    op.drop_index(op.f('ix_community_views_user_id'), table_name='community_views')
    op.drop_table('community_views')
    op.drop_index('ix_community_comments_post', table_name='community_comments')
    op.drop_table('community_comments')
    op.drop_index(op.f('ix_community_likes_user_id'), table_name='community_likes')
    op.drop_table('community_likes')
    op.drop_index('ix_community_posts_feed', table_name='community_posts')
    op.drop_index(op.f('ix_community_posts_author_id'), table_name='community_posts')
    op.drop_index(op.f('ix_community_posts_id'), table_name='community_posts')
    op.drop_table('community_posts')
